const express = require('express');
const { supabase } = require('../utils/supabaseClient');
const { OpenAI } = require('openai');
const authUser = require('../middleware/authUser');
const conversationState = require('../utils/conversationState');
const { startQuiz, answerQuiz, getQuizStatus } = require('../controllers/quiz');

const router = express.Router();

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

// Helper function to get MOMi base prompt with user context
async function getMomiBasePromptWithUserContext(userProfile) {
    // Get base prompt
    const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'momi_base_prompt')
        .single();

    let basePrompt = 'You are MOMi, a helpful AI wellness assistant. Your goal is to support users, provide helpful information, and guide them towards well-being resources. Do not offer medical advice.';

    if (data && !error) {
        basePrompt = data.setting_value;
    }

    // Add user context to the prompt
    const userContext = buildUserContextPrompt(userProfile);

    return `${basePrompt}

${userContext}

Remember to be empathetic, supportive, and personalized in your responses based on the user's profile and preferences.`;
}

// Helper function to build user context prompt
function buildUserContextPrompt(userProfile) {
    let context = "\n--- USER PROFILE CONTEXT ---\n";

    context += `User: ${userProfile.first_name} ${userProfile.last_name}\n`;

    if (userProfile.family_roles && userProfile.family_roles.length > 0) {
        const roles = userProfile.family_roles.map(role => {
            switch(role) {
                case 'hoping_to_become_mother': return 'hoping to become a mother';
                case 'currently_pregnant': return 'currently pregnant';
                case 'mom_young_children': return 'mom of young children (0-5)';
                case 'mom_school_age': return 'mom of school-age children (6-12)';
                case 'mom_teens': return 'mom of teens (13-18)';
                case 'wise_woman': return 'wise woman helping raise children';
                default: return role;
            }
        });
        context += `Family Role: ${roles.join(', ')}\n`;
    }

    if (userProfile.children_count > 0) {
        context += `Number of Children: ${userProfile.children_count}\n`;

        if (userProfile.children_ages && userProfile.children_ages.length > 0) {
            const ages = userProfile.children_ages.map(age => {
                switch(age) {
                    case '0-2': return '0-2 (Infant/Toddler)';
                    case '3-5': return '3-5 (Preschool)';
                    case '6-12': return '6-12 (School-age)';
                    case '13-18': return '13-18 (Teen)';
                    case '18+': return '18+ (Young Adult)';
                    case 'expecting': return 'expecting a child';
                    default: return age;
                }
            });
            context += `Children Ages: ${ages.join(', ')}\n`;
        }
    }

    if (userProfile.main_concerns && userProfile.main_concerns.length > 0) {
        const concerns = userProfile.main_concerns.map(concern => {
            switch(concern) {
                case 'food': return 'Food: Nourishment and healing';
                case 'resilience': return 'Resilience: Stress, sleep, nervous system support';
                case 'movement': return 'Movement: Physical activity and energy';
                case 'community': return 'Community: Relationships and support';
                case 'spiritual': return 'Spiritual: Purpose and emotional healing';
                case 'environment': return 'Environment: Detoxifying home';
                case 'abundance': return 'Abundance: Financial health and resources';
                default: return concern;
            }
        });
        context += `Main Wellness Goals: ${concerns.join(', ')}\n`;

        if (userProfile.main_concerns_other) {
            context += `Additional Concern: ${userProfile.main_concerns_other}\n`;
        }
    }

    if (userProfile.dietary_preferences && userProfile.dietary_preferences.length > 0) {
        const dietary = userProfile.dietary_preferences.map(pref => {
            switch(pref) {
                case 'gluten_free': return 'gluten-free';
                case 'dairy_free': return 'dairy-free';
                case 'nut_free': return 'nut-free';
                case 'soy_free': return 'soy-free';
                case 'vegetarian': return 'vegetarian';
                case 'vegan': return 'vegan';
                case 'no_preference': return 'no specific dietary preferences';
                default: return pref;
            }
        });
        context += `Dietary Preferences: ${dietary.join(', ')}\n`;

        if (userProfile.dietary_preferences_other) {
            context += `Additional Dietary Info: ${userProfile.dietary_preferences_other}\n`;
        }
    }

    if (userProfile.personalized_support) {
        context += `Preferences: Open to personalized recommendations and tailored content\n`;
    }

    context += "--- END USER PROFILE ---\n\n";

    return context;
}

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

        // 4. Prepare context for OpenAI
        const { data: recentMessages, error: historyError } = await supabase
            .from('messages')
            .select('sender_type, content, content_type, metadata')
            .eq('conversation_id', currentConversationId)
            .order('timestamp', { ascending: true })
            .limit(10);
        if (historyError) throw historyError;

        // Get personalized system prompt
        const systemPrompt = await getMomiBasePromptWithUserContext(userProfile);

        // Add RAG context if available
        let finalSystemPrompt = systemPrompt;
        if (ragContext) {
            finalSystemPrompt = `${systemPrompt}\n\nRelevant information from knowledge base:\n${ragContext}\n\nUse this information to provide accurate and helpful responses when relevant.`;
        }

        // Map historical messages to OpenAI format
        const historicalOpenAIMessages = recentMessages.map(msg => {
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

        // 5. Call OpenAI API
        const completion = await openai.chat.completions.create({
            model: imageUrl ? "gpt-4o" : "gpt-3.5-turbo",
            messages: openAIMessages,
            max_tokens: imageUrl ? 1024 : (ragContext ? 1200 : 1024)
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

        // 7. Update user's chatbot memory if needed
        if (userProfile.chatbot_memory) {
            // Update conversation topics, preferences, etc.
            const updatedMemory = {
                ...userProfile.chatbot_memory,
                last_conversation_at: new Date().toISOString(),
                recent_topics: [
                    ...(userProfile.chatbot_memory.recent_topics || []).slice(-4),
                    message ? message.substring(0, 100) : 'image_shared'
                ]
            };

            await supabase
                .from('user_profiles')
                .update({ chatbot_memory: updatedMemory })
                .eq('auth_user_id', user.id);
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
                summary
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

module.exports = router;