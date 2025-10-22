const express = require('express');
const multer = require('multer');
const { supabase } = require('../utils/supabaseClient');
const { OpenAI } = require('openai');
const authUser = require('../middleware/authUser');
const conversationState = require('../utils/conversationState');
const { startQuiz, answerQuiz, getQuizStatus } = require('../controllers/quiz');
const { buildSystemPrompt, getPersonalizedWelcomeMessage } = require('../utils/buildSystemPrompt');
const { extractAndSavePreferences } = require('../utils/updateChatbotMemory');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();

// Multer configuration for image uploads
const uploadImage = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Multer configuration for audio uploads
const uploadAudio = multer({ 
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit for audio files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Helper function to get embedding
async function getEmbedding(text) {
    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: text.replace(/\n/g, ' ')
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error("Error getting embedding from OpenAI:", error.response ? error.response.data : error.message);
        throw error;
    }
}

// Note: User context building functions have been moved to utils/buildUserContext.js
// and utils/buildSystemPrompt.js for better organization and reusability

// Chat message route - now requires authentication
router.post('/message', authUser, async (req, res) => {
    const { conversationId, message, imageUrl } = req.body;
    let currentConversationId = conversationId;

    // Get authenticated user and profile from middleware
    const user = req.user;
    const userProfile = req.userProfile;

    if (!message && !imageUrl) {
        return res.status(400).json({ error: 'Message or image URL is required.' });
    }

    try {
        // Get conversation state for this user
        const state = conversationState.getState(user.id);

        // Check if user wants to start the quiz
        if (message && message.toLowerCase().trim() === 'start nervous system quiz') {
            const quizReq = { body: { userId: user.id } };
            const quizRes = {
                json: (data) => res.json(data),
                status: (code) => ({
                    json: (data) => res.status(code).json(data)
                })
            };
            return startQuiz(quizReq, quizRes);
        }

        // Check if user is in quiz and sending an answer
        if (state.quiz && state.quiz.phase === 'question' && message && /^[ABC]$/i.test(message.trim())) {
            const quizReq = {
                body: {
                    userId: user.id,
                    choice: message.trim().toUpperCase()
                }
            };
            const quizRes = {
                json: (data) => res.json(data),
                status: (code) => ({
                    json: (data) => res.status(code).json(data)
                })
            };
            return answerQuiz(quizReq, quizRes);
        }

        // 1. Create conversation if it doesn't exist
        if (!currentConversationId) {
            const { data: newConversation, error: convError } = await supabase
                .from('conversations')
                .insert([{ user_id: user.id }])
                .select('id')
                .single();
            if (convError) throw convError;
            currentConversationId = newConversation.id;
        }

        // 2. Store user's message
        const userMessagePayload = {
            conversation_id: currentConversationId,
            sender_type: 'user',
            content_type: imageUrl ? 'image_url' : 'text',
            content: imageUrl ? imageUrl : message,
            metadata: imageUrl ? { original_user_prompt: message, is_image_request: true } : {}
        };
        const { error: userMessageError } = await supabase.from('messages').insert([userMessagePayload]);
        if (userMessageError) throw userMessageError;

        // 3. RAG: Retrieve relevant context
        let ragContext = '';
        let ragSources = [];
        let kbConfig = { similarity_threshold: 0.78, max_chunks: 5, use_top_chunks: 3, debug_mode: false };

        // Fetch KB configuration
        try {
            const { data: configData } = await supabase
                .from('system_settings')
                .select('setting_value')
                .eq('setting_key', 'kb_retrieval_config')
                .single();
            if (configData) {
                kbConfig = JSON.parse(configData.setting_value);
            }
        } catch (configError) {
            console.error("Error fetching KB config, using defaults:", configError);
        }

        if (message && !imageUrl) {
            try {
                const startTime = Date.now();
                const queryEmbedding = await getEmbedding(message);
                const embeddingTime = Date.now() - startTime;

                const { data: chunks, error: matchError } = await supabase.rpc('match_document_chunks', {
                    query_embedding: queryEmbedding,
                    match_threshold: kbConfig.similarity_threshold,
                    match_count: kbConfig.max_chunks
                });

                if (!matchError && chunks && chunks.length > 0) {
                    const topChunks = chunks.sort((a, b) => b.similarity - a.similarity).slice(0, kbConfig.use_top_chunks);

                    const docIds = [...new Set(topChunks.map(c => c.document_id))];
                    const { data: docs } = await supabase
                        .from('knowledge_base_documents')
                        .select('id, file_name')
                        .in('id', docIds);

                    const docMap = docs ? Object.fromEntries(docs.map(d => [d.id, d.file_name])) : {};

                    ragContext = topChunks.map((chunk) => {
                        const fileName = docMap[chunk.document_id] || 'Unknown Document';
                        return `<!-- Source: ${fileName} -->\n${chunk.chunk_text}`;
                    }).join("\n\n---\n\n");

                    ragSources = topChunks.map(chunk => ({
                        fileName: docMap[chunk.document_id] || 'Unknown',
                        similarity: chunk.similarity,
                        metadata: chunk.metadata || {}
                    }));
                }
            } catch (ragError) {
                console.error("Error during RAG retrieval:", ragError.message);
            }
        }

        // 4. Prepare context for OpenAI - Load conversation history
        const { data: recentMessages, error: historyError } = await supabase
            .from('messages')
            .select('sender_type, content, content_type, metadata')
            .eq('conversation_id', currentConversationId)
            .order('timestamp', { ascending: false })
            .limit(30); // Get last 30 messages for maximum context retention
        if (historyError) throw historyError;

        // Reverse to get chronological order (oldest first)
        const chronologicalMessages = (recentMessages || []).reverse();

        // 5. Build personalized system prompt with RAG context
        const finalSystemPrompt = await buildSystemPrompt(userProfile, supabase, ragContext);
        
        console.log(`📝 Building context for ${userProfile.first_name}:`, {
            conversationId: currentConversationId,
            historyCount: chronologicalMessages.length,
            hasRAG: !!ragContext,
            dietaryPrefs: userProfile.dietary_preferences?.length || 0,
            mainConcerns: userProfile.main_concerns?.length || 0
        });

        // Map historical messages to OpenAI format (use chronological order)
        const historicalOpenAIMessages = chronologicalMessages
            .filter(msg => msg.content && msg.content.trim()) // Filter empty messages
            .map(msg => {
                let content;
                if (msg.content_type === 'image_url') {
                    content = `[User sent an image: ${msg.metadata?.original_user_prompt || 'User uploaded an image.'}]`;
                } else {
                    content = msg.content;
                }
                return {
                    role: msg.sender_type === 'momi' ? 'assistant' : 'user',
                    content: content
                };
            });

        // Build final messages array
        const openAIMessages = [
            { role: "system", content: finalSystemPrompt },
            ...historicalOpenAIMessages
        ];

        // Add current user's message
        if (imageUrl) {
            const currentUserContent = [];
            if (message) {
                currentUserContent.push({ type: "text", text: message });
            }

            try {
                // Convert image URL to data URI for OpenAI
                const axios = require('axios');
                const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                const mimeType = response.headers['content-type'] || 'image/jpeg';
                const base64 = Buffer.from(response.data, 'binary').toString('base64');
                const dataUri = `data:${mimeType};base64,${base64}`;

                currentUserContent.push({ type: "image_url", image_url: { url: dataUri } });
                openAIMessages.push({ role: "user", content: currentUserContent });
            } catch (conversionError) {
                console.error("Error converting image:", conversionError);
                const fallbackText = message ? `[Image upload failed] ${message}` : "[Image upload failed]";
                openAIMessages.push({ role: "user", content: fallbackText });
            }
        } else if (message) {
            openAIMessages.push({ role: "user", content: message });
        }

        // 5. Call OpenAI API - Use GPT-4o for better context retention
        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // Using gpt-4o for all messages for better context and continuity
            messages: openAIMessages,
            max_tokens: imageUrl ? 1024 : (ragContext ? 1200 : 1024),
            temperature: 0.7 // Balanced creativity and consistency
        });

        const momiResponseText = completion.choices[0].message.content;

        // 6. Store MOMi's response
        const momiMessagePayload = {
            conversation_id: currentConversationId,
            sender_type: 'momi',
            content_type: 'text',
            content: momiResponseText,
            openai_message_id: completion.id
        };
        const { error: momiMessageError } = await supabase.from('messages').insert([momiMessagePayload]);
        if (momiMessageError) throw momiMessageError;

        // 7. Extract and save new preferences mentioned in the conversation (async, non-blocking)
        if (message && message.trim()) {
            extractAndSavePreferences(user.id, message, momiResponseText, supabase)
                .catch(err => console.error('Memory extraction failed (non-critical):', err.message));
        }

        res.json({
            reply: momiResponseText,
            conversationId: currentConversationId,
            sources: ragSources.length > 0 ? ragSources : undefined
        });

    } catch (error) {
        console.error('Error processing chat message:', error);
        res.status(500).json({
            error: 'Failed to process chat message',
            details: error.message
        });
    }
});

// Get personalized welcome message
router.get('/welcome', authUser, async (req, res) => {
    try {
        const userProfile = req.userProfile;
        const welcomeMessage = await getPersonalizedWelcomeMessage(userProfile, supabase);
        
        res.json({
            message: welcomeMessage,
            userName: userProfile?.first_name || 'there'
        });
    } catch (error) {
        console.error('Error getting welcome message:', error);
        res.json({
            message: "Hi there! 😊 I'm MOMi, your wellness assistant. How can I help you today?",
            userName: 'there'
        });
    }
});

// Get chat history - requires authentication
router.get('/history/:conversationId', authUser, async (req, res) => {
    const { conversationId } = req.params;
    const user = req.user;

    try {
        // Verify user owns this conversation
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .select('user_id')
            .eq('id', conversationId)
            .single();

        if (convError || !conversation) {
            return res.status(404).json({ error: 'Conversation not found.' });
        }

        if (conversation.user_id !== user.id) {
            return res.status(403).json({ error: 'Access denied to this conversation.' });
        }

        // Get messages
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('timestamp', { ascending: true });

        if (error) throw error;
        res.json(messages);
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ error: 'Failed to fetch chat history', details: error.message });
    }
});

// Get user's conversations
router.get('/conversations', authUser, async (req, res) => {
    const user = req.user;

    try {
        // Get conversations with message counts and last message timestamp
        const { data: conversations, error } = await supabase
            .from('conversations')
            .select(`
                id,
                created_at,
                last_message_at,
                metadata
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Enhance conversations with message data
        const enhancedConversations = await Promise.all(
            conversations.map(async (conv) => {
                // Get message count and last message for each conversation
                const { data: messages, error: msgError } = await supabase
                    .from('messages')
                    .select('content, timestamp, sender_type')
                    .eq('conversation_id', conv.id)
                    .order('timestamp', { ascending: false })
                    .limit(1);

                if (msgError) {
                    console.error('Error fetching messages for conversation:', msgError);
                    return {
                        ...conv,
                        message_count: 0,
                        last_message_at: conv.created_at,
                        last_message: null
                    };
                }

                // Get total message count
                const { count, error: countError } = await supabase
                    .from('messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('conversation_id', conv.id);

                const lastMessage = messages && messages.length > 0 ? messages[0] : null;
                const lastMessagePreview = lastMessage 
                    ? (lastMessage.sender_type === 'user' 
                        ? lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? '...' : '')
                        : lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? '...' : ''))
                    : null;

                return {
                    ...conv,
                    message_count: count || 0,
                    last_message_at: lastMessage ? lastMessage.timestamp : conv.created_at,
                    last_message: lastMessagePreview
                };
            })
        );

        // Sort by last message timestamp
        enhancedConversations.sort((a, b) => 
            new Date(b.last_message_at) - new Date(a.last_message_at)
        );

        res.json(enhancedConversations);
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: 'Failed to fetch conversations', details: error.message });
    }
});

// Reset session endpoint
router.post('/reset-session', authUser, async (req, res) => {
    const user = req.user;

    try {
        const wasReset = conversationState.resetState(user.id);

        res.json({
            success: true,
            message: wasReset ? 'Session state has been reset successfully.' : 'No active session found to reset.',
            userId: user.id
        });
    } catch (error) {
        console.error('Error resetting session:', error);
        res.status(500).json({ error: 'Failed to reset session', details: error.message });
    }
});

// Quiz routes
router.post('/quiz/start', authUser, startQuiz);
router.post('/quiz/answer', authUser, answerQuiz);
router.post('/quiz/status', authUser, getQuizStatus);

// Upload image endpoint
router.post('/upload', authUser, uploadImage.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        const user = req.user;
        const fileName = `${user.id}/${Date.now()}-${req.file.originalname}`;
        
        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('momi-uploads')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Supabase storage error:', error);
            return res.status(500).json({ error: 'Failed to upload image', details: error.message });
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
            .from('momi-uploads')
            .getPublicUrl(fileName);

        res.json({ 
            imageUrl: publicUrlData.publicUrl,
            message: 'Image uploaded successfully'
        });

    } catch (error) {
        console.error('Image upload error:', error);
        res.status(500).json({ error: 'Failed to upload image', details: error.message });
    }
});

// Speech to text endpoint
router.post('/speech-to-text', authUser, uploadAudio.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        console.log('Received audio file:', {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        });

        // Validate file size (max 25MB)
        if (req.file.size > 25 * 1024 * 1024) {
            return res.status(413).json({ error: 'Audio file too large. Maximum size is 25MB.' });
        }

        // Validate file has content
        if (req.file.size === 0) {
            return res.status(400).json({ error: 'Audio file is empty' });
        }

        // Create a temporary file for OpenAI Whisper
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        
        const tempDir = os.tmpdir();
        
        // Determine file extension from original filename or mimetype
        let fileExtension = 'webm'; // default
        if (req.file.originalname) {
            const ext = path.extname(req.file.originalname).toLowerCase();
            if (ext) {
                fileExtension = ext.substring(1); // remove the dot
            }
        } else if (req.file.mimetype) {
            if (req.file.mimetype.includes('mp4')) fileExtension = 'mp4';
            else if (req.file.mimetype.includes('wav')) fileExtension = 'wav';
            else if (req.file.mimetype.includes('ogg')) fileExtension = 'ogg';
            else if (req.file.mimetype.includes('mpeg')) fileExtension = 'mp3';
        }
        
        const tempFileName = `audio_${Date.now()}_${req.user.id}.${fileExtension}`;
        const tempFilePath = path.join(tempDir, tempFileName);
        
        console.log('Creating temporary file:', tempFilePath);
        
        // Write buffer to temporary file
        fs.writeFileSync(tempFilePath, req.file.buffer);
        
        try {
            // Use OpenAI Whisper for transcription
            console.log('Starting transcription with OpenAI Whisper...');
            const transcription = await openai.audio.transcriptions.create({
                file: fs.createReadStream(tempFilePath),
                model: 'whisper-1',
                language: 'en', // English - can be made dynamic later
                response_format: 'json',
                temperature: 0.2 // Lower temperature for more consistent results
            });

            console.log('Transcription completed:', {
                text: transcription.text,
                length: transcription.text?.length || 0
            });

            // Clean up temporary file
            fs.unlinkSync(tempFilePath);

            // Validate transcription result
            if (!transcription.text || transcription.text.trim().length === 0) {
                return res.status(400).json({ 
                    error: 'No speech detected in audio',
                    transcript: '',
                    message: 'The audio file appears to be silent or unclear. Please try speaking more clearly.'
                });
            }

            res.json({ 
                transcript: transcription.text.trim(),
                message: 'Audio transcribed successfully'
            });

        } catch (transcriptionError) {
            console.error('OpenAI Whisper transcription error:', transcriptionError);
            
            // Clean up temporary file on error
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
            
            // Handle specific OpenAI errors
            if (transcriptionError.code === 'insufficient_quota') {
                return res.status(503).json({ 
                    error: 'Service temporarily unavailable',
                    details: 'Speech recognition service quota exceeded. Please try again later.'
                });
            } else if (transcriptionError.code === 'invalid_request_error') {
                return res.status(400).json({ 
                    error: 'Invalid audio format',
                    details: 'The audio file format is not supported. Please try recording again.'
                });
            }
            
            throw transcriptionError;
        }

    } catch (error) {
        console.error('Speech to text error:', error);
        
        // Handle multer errors
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ 
                error: 'Audio file too large',
                details: 'Maximum file size is 25MB'
            });
        }
        
        res.status(500).json({ 
            error: 'Failed to transcribe audio', 
            details: error.message || 'Internal server error during audio processing'
        });
    }
});

module.exports = router;