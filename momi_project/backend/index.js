require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');
const crypto = require('crypto'); // For generating guest session tokens
const multer = require('multer'); // For file uploads
const path = require('path');
const fs = require('fs'); // Needed for OpenAI SDK to read file from path for Whisper
const pdf = require('pdf-parse'); // For PDF text extraction
const authAdmin = require('./middleware/authAdmin'); // Import admin auth middleware
const axios = require('axios'); // Added for image URL to Data URI conversion
const cors = require('cors'); // <-- ADD THIS LINE
const conversationState = require('./utils/conversationState'); // Import conversation state manager
const { startQuiz, answerQuiz, getQuizStatus } = require('./controllers/quiz'); // Import quiz controllers

// --- Bloque de saludos y emojis de MOMi ---
const FIRST_SECOND_TIME_GREETINGS = [
  "Hi there, I'm really glad you're here. How can I help you or your family today? 😊",
  "Hello, it's nice to meet you. Is there anything on your mind you'd like to talk about?",
  "Hi, welcome! How are you doing today? Anything you need support with?",
  "Hello, so happy you stopped by. Is there something you'd like a hand with right now?",
  "Hi, I hope your day is going well. Let me know how I can help."
];

const RETURNING_GREETINGS = [
  "Hey sweetie, how's today treating you? Need anything, or just want to chat? 💛",
  "Hi love, how are things? Is there something you want to share today?",
  "Hey, it's always good to connect. How are you and the kiddos?",
  "Hi mama, hope your day's going smoothly. What's up?",
  "Hey there, I'm here for you—what's on your heart today? 😊"
];

const TIME_OF_DAY_GREETINGS = [
  "Good morning, love. How did you sleep? Is there anything you want to talk through today? 🌞",
  "Hi there, hope your afternoon's going okay. Anything I can help you with right now?",
  "Evening, sweetie. How was your day? Want to unwind or talk something out? 🌙"
];

const SITUATION_SPECIFIC_GREETINGS = [
  "Hi love, need any quick dinner ideas or just a bit of encouragement today?",
  "Hey mama, looking for some stress relief tips or family routine ideas?",
  "Hello, is there anything about meal planning or the kids' routines on your mind?",
  "Hi, if you've got questions about balancing work and family, I'm here to help."
];

const GENTLE_EMOJIS = ["😊", "💛", "🌞", "🌙"];

const app = express();
const port = process.env.PORT || 3001;

// --- CORS Configuration ---
// Define allowed origins
const allowedOrigins = [
  'https://7pillarsmission.com',
  /.*\.replit\.dev$/,
  /.*\.repl\.co$/
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return allowedOrigin === origin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    })) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // If your frontend needs to send cookies or authorization headers
  // methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Specify allowed methods
  // allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'], // Specify allowed headers
};

// Enable CORS for all routes with updated options
app.use(cors({
  origin: true, // Allow all origins for now
  credentials: true
}));
// If you want to be more specific and only apply CORS to the /widget path:
// app.use('/widget', cors(corsOptions), express.static(widgetDistPath));
// However, your API routes (/api/*) will also need CORS if called cross-origin.
// So, applying it globally like above is often simpler if the widget and API are on the same backend.

// --- Middleware for serving static frontend files ---

// Serve Landing Page (from momi_project/frontend_landing)
app.use(express.static(path.join(__dirname, '../frontend_landing')));

// Serve Admin Panel (from momi_project/frontend_admin/dist)
// All /admin/* routes should serve the admin panel's index.html for client-side routing
const adminDistPath = path.join(__dirname, '../frontend_admin/dist');
app.use('/admin', express.static(adminDistPath));
app.get( /^\/admin\/.*/ , (req, res) => { // Changed to use a RegExp for Express 5 compatibility
    res.sendFile(path.join(adminDistPath, 'index.html'));
});

// Serve Chat Widget static assets (from momi_project/frontend_widget/dist)
// This allows the widget's JS/CSS to be loaded, e.g., by the landing page or for testing.
const widgetDistPath = path.join(__dirname, '../frontend_widget/dist');
app.use('/widget', express.static(widgetDistPath));
// If the widget has an index.html for testing, you could serve it too:
// app.get('/widget', (req, res) => {
//     res.sendFile(path.join(widgetDistPath, 'index.html'));
// });

// Initialize Supabase client
// It's recommended to use the SERVICE_ROLE_KEY for backend operations 
// that need to bypass RLS, especially for managing guest users or admin tasks.
// However, for user-specific actions initiated by a logged-in user, 
// you might use the user's JWT to make RLS-aware requests.
// For simplicity here, we use anon key, but be mindful of RLS.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; 
if (!supabaseServiceKey) {
    console.warn('SUPABASE_SERVICE_KEY is not set. File uploads and certain admin operations might fail or be insecure.');
}
const supabase = createClient(supabaseUrl, supabaseServiceKey || process.env.SUPABASE_ANON_KEY);

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Helper function to convert image URL to Data URI
async function imageUrlToDataUri(url) {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer'
        });
        const mimeType = response.headers['content-type'] || 'image/jpeg'; // Default if not found
        const base64 = Buffer.from(response.data, 'binary').toString('base64');
        return `data:${mimeType};base64,${base64}`;
    } catch (error) {
        console.error(`Failed to convert image URL ${url} to Data URI:`, error.message);
        throw new Error(`Failed to process image URL for AI: ${url}`); // Re-throw to be caught by chat handler
    }
}

// Multer setup for image uploads (memory storage)
const imageStorage = multer.memoryStorage();
const imageUpload = multer({ 
    storage: imageStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb("Error: Image format invalid.");
    }
});

// Multer setup for audio uploads (disk storage for Whisper API compatibility with file path)
// Create an 'uploads/' directory if it doesn't exist for temporary audio files
const audioUploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(audioUploadDir)) {
    fs.mkdirSync(audioUploadDir);
}
const audioStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, audioUploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Appending extension
    }
});
const audioUpload = multer({
    storage: audioStorage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit for Whisper
    fileFilter: (req, file, cb) => {
        // Common audio types, adjust as needed. WebM and MP4 are good for browser MediaRecorder.
        const filetypes = /webm|mp4|mp3|m4a|mpeg|wav|ogg/;
        const mimetype = filetypes.test(file.mimetype);
        // Original name might not have extension from Blob, so primarily rely on mimetype
        // const extname = filetypes.test(path.extname(file.originalname).toLowerCase()); 
        if (mimetype) {
            return cb(null, true);
        }
        cb("Error: Audio format invalid.");
    }
});

// Multer for RAG document uploads (PDF, TXT, MD)
const ragDocumentStorage = multer.memoryStorage(); // Process in memory
const ragDocumentUpload = multer({
    storage: ragDocumentStorage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit for documents
    fileFilter: (req, file, cb) => {
        const allowedTypes = /pdf|plain|markdown/;
        const allowedExts = /pdf|txt|md/;
        if (allowedTypes.test(file.mimetype) && allowedExts.test(path.extname(file.originalname).toLowerCase())) {
            cb(null, true);
        } else {
            cb("Error: Document upload only supports PDF, TXT, MD.");
        }
    }
});

app.use(express.json()); // Middleware to parse JSON bodies
app.use(express.urlencoded({ extended: true })); // For form data

// --- Helper Functions ---
async function getMomiBasePrompt() {
    const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'momi_base_prompt')
        .single();
    if (error || !data) {
        console.error('Error fetching Momi base prompt:', error);
        return 'You are a helpful AI assistant. Your goal is to support users, provide helpful information, and guide them towards well-being resources. Do not offer medical advice.'; // Fallback prompt
    }
    return data.setting_value;
}

// --- RAG Helper Functions ---
async function extractTextFromPdf(buffer) {
    const data = await pdf(buffer);
    return data.text;
}

function chunkText(text, chunkSize = 1000, overlap = 100) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        const end = Math.min(i + chunkSize, text.length);
        chunks.push(text.substring(i, end));
        i += (chunkSize - overlap);
        if (i + overlap >= text.length && end < text.length) { // Ensure last bit is captured
             chunks.push(text.substring(end - overlap));
             break;
        }
    }
    // A simple way to handle very small last chunks or ensure overlap logic doesn't miss end.
    // This part can be refined based on how strictly overlap needs to be managed for last chunk.
    return chunks.filter(chunk => chunk.trim() !== '');
}

async function getEmbedding(text) {
    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002", // Or your chosen model
            input: text.replace(/\n/g, ' ') // OpenAI recommends replacing newlines
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error("Error getting embedding from OpenAI:", error.response ? error.response.data : error.message);
        throw error;
    }
}

// --- Greeting Helper Functions ---
/**
 * Determines the time of day based on the current date
 * @returns {string} "morning" (5am-11:59am), "afternoon" (12pm-4:59pm), or "evening" (5pm-4:59am)
 */
function getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon"; 
    return "evening";
}

/**
 * Picks a random greeting from a pool that hasn't been shown yet in this session
 * @param {Array<string>} pool - Array of greeting strings
 * @param {Object} state - Conversation state object with greetings_shown array
 * @returns {string} A greeting that hasn't been shown yet
 */
function pickGreeting(pool, state) {
    // Filter out greetings that have already been shown
    const availableGreetings = pool.filter(g => !state.greetings_shown.includes(g));
    
    // If all greetings have been shown, reset and use the full pool
    if (availableGreetings.length === 0) {
        state.greetings_shown = [];
        return pool[Math.floor(Math.random() * pool.length)];
    }
    
    // Pick a random greeting from available ones
    return availableGreetings[Math.floor(Math.random() * availableGreetings.length)];
}

/**
 * Selects an appropriate greeting based on user status and context
 * @param {Object} state - Conversation state object
 * @param {string} context - Optional context about the conversation
 * @returns {string} The selected greeting with emoji
 */
function selectGreeting(state, context = null) {
    let greeting;
    let pool;

    // 10% chance for time-based greeting
    if (Math.random() < 0.1) {
        const timeOfDay = getTimeOfDay();
        greeting = TIME_OF_DAY_GREETINGS[timeOfDay === "morning" ? 0 : timeOfDay === "afternoon" ? 1 : 2];
        pool = TIME_OF_DAY_GREETINGS;
    }
    // 15% chance for situation-specific greeting
    else if (Math.random() < 0.15 && state.user_status === 'returning') {
        pool = SITUATION_SPECIFIC_GREETINGS;
        greeting = pickGreeting(pool, state);
    }
    // Otherwise, use status-based greeting
    else {
        if (state.user_status === 'first_time' || state.user_status === 'second_time') {
            pool = FIRST_SECOND_TIME_GREETINGS;
        } else {
            pool = RETURNING_GREETINGS;
        }
        greeting = pickGreeting(pool, state);
    }

    // Add emoji if greeting doesn't already have one
    if (!GENTLE_EMOJIS.some(emoji => greeting.includes(emoji))) {
        const randomEmoji = GENTLE_EMOJIS[Math.floor(Math.random() * GENTLE_EMOJIS.length)];
        greeting = `${greeting} ${randomEmoji}`;
    }

    return greeting;
}

/**
 * Determines user status based on conversation history
 * @param {string} userId - User ID or Guest User ID
 * @returns {Promise<string>} "first_time", "second_time", or "returning"
 */
async function determineUserStatus(userId) {
    try {
        const { count, error } = await supabase
            .from('conversations')
            .select('*', { count: 'exact', head: true })
            .or(`user_id.eq.${userId},guest_user_id.eq.${userId}`);
        
        if (error) {
            console.error('Error determining user status:', error);
            return 'first_time'; // Default to first_time on error
        }

        if (count === 0) return 'first_time';
        if (count === 1) return 'second_time';
        return 'returning';
    } catch (error) {
        console.error('Error in determineUserStatus:', error);
        return 'first_time';
    }
}

// --- Admin Routes (Protected by authAdmin middleware) ---
const adminRouter = express.Router();
adminRouter.use(authAdmin); // Apply admin auth middleware to all routes in adminRouter

adminRouter.post('/rag/upload-document', ragDocumentUpload.single('document'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No document file provided.' });
    // Service key check is implicitly handled by middleware or Supabase client config for admin operations

    try {
        let textContent;
        const fileType = path.extname(req.file.originalname).toLowerCase().substring(1);

        if (fileType === 'pdf') {
            textContent = await extractTextFromPdf(req.file.buffer);
        } else if (fileType === 'txt' || fileType === 'md') {
            textContent = req.file.buffer.toString('utf-8');
        } else {
            return res.status(400).json({ error: 'Unsupported file type for RAG.' });
        }

        const { data: docData, error: docError } = await supabase
            .from('knowledge_base_documents')
            .insert({ file_name: req.file.originalname, file_type: fileType })
            .select('id').single();
        if (docError) throw docError;
        const documentId = docData.id;

        const chunks = chunkText(textContent, 1500, 150);
        let processedChunks = 0;
        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            const chunk = chunks[chunkIndex];
            if (chunk.trim().length < 10) continue;
            try {
                const embedding = await getEmbedding(chunk);
                
                // Prepare metadata for better traceability
                const chunkMetadata = {
                    fileName: req.file.originalname,
                    chunkIndex: chunkIndex,
                    totalChunks: chunks.length,
                    chunkSize: chunk.length,
                    fileType: fileType
                };
                
                // Add page information for PDFs if we can extract it
                // Note: pdf-parse doesn't provide page-level extraction by default
                // This is a placeholder for future enhancement
                if (fileType === 'pdf') {
                    chunkMetadata.page = 'N/A'; // Would need enhanced PDF parsing for accurate page numbers
                }
                
                const { error: chunkError } = await supabase
                    .from('document_chunks')
                    .insert({ 
                        document_id: documentId, 
                        chunk_text: chunk, 
                        embedding: embedding,
                        metadata: chunkMetadata // Add metadata
                    });
                if (chunkError) {
                    console.error(`Failed to store chunk ${chunkIndex} for doc ${documentId}:`, chunkError.message);
                    continue;
                }
                processedChunks++;
                
                // Log progress for large documents
                if (processedChunks % 10 === 0 && chunks.length > 20) {
                    console.log(`Progress: Processed ${processedChunks}/${chunks.length} chunks for ${req.file.originalname}`);
                }
            } catch(embeddingError){
                 console.error(`Failed to get embedding for chunk ${chunkIndex} of doc ${documentId}:`, embeddingError.message);
            }
        }
        
        await supabase.from('knowledge_base_documents').update({ last_indexed_at: new Date().toISOString() }).eq('id', documentId);

        // Enhanced logging for debugging
        console.log(`Document ingestion completed:`, {
            fileName: req.file.originalname,
            fileType: fileType,
            documentId: documentId,
            totalChunks: chunks.length,
            processedChunks: processedChunks,
            failedChunks: chunks.length - processedChunks,
            timestamp: new Date().toISOString()
        });

        res.status(201).json({ 
            message: `Document uploaded and processed. ${processedChunks} chunks created.`, 
            documentId: documentId,
            fileName: req.file.originalname,
            stats: {
                totalChunks: chunks.length,
                processedChunks: processedChunks,
                failedChunks: chunks.length - processedChunks
            }
        });
    } catch (error) {
        console.error('Error processing RAG document:', error);
        res.status(500).json({ error: 'Failed to process RAG document', details: error.message });
    }
});

// New route to delete a RAG document and its chunks
adminRouter.delete('/rag/document/:documentId', async (req, res) => {
    const { documentId } = req.params;

    if (!documentId) {
        return res.status(400).json({ error: 'Document ID is required.' });
    }

    try {
        // 1. Delete associated chunks first (important for foreign key constraints)
        const { error: chunkDeleteError } = await supabase
            .from('document_chunks')
            .delete()
            .eq('document_id', documentId);

        if (chunkDeleteError) {
            console.error(`Error deleting chunks for document ${documentId}:`, chunkDeleteError.message);
            // Decide if you want to stop or proceed to delete the main document entry
            // For now, we'll throw to indicate the operation wasn't fully successful
            throw new Error(`Failed to delete document chunks: ${chunkDeleteError.message}`);
        }

        // 2. Delete the document itself from knowledge_base_documents
        const { data: docData, error: docDeleteError } = await supabase
            .from('knowledge_base_documents')
            .delete()
            .eq('id', documentId)
            .select() // Optionally select to confirm what was deleted or if it existed
            .single(); // Use .single() if you expect only one row, or remove if not needed

        if (docDeleteError) {
            console.error(`Error deleting document ${documentId}:`, docDeleteError.message);
            throw new Error(`Failed to delete document: ${docDeleteError.message}`);
        }

        if (!docData) {
             // This means no document with that ID was found, could be a 404
             console.log(`Document with ID ${documentId} not found for deletion.`);
             return res.status(404).json({ message: 'Document not found.' });
        }

        res.status(200).json({ 
            message: `Document (ID: ${documentId}) and its associated chunks deleted successfully.`,
            deletedDocument: docData
        });

    } catch (error) {
        console.error(`Error in delete RAG document endpoint for ID ${documentId}:`, error);
        // Check if the error message already contains specifics from Supabase errors
        const detail = error.message.includes('Failed to delete') ? error.message : 'Internal server error during document deletion.';
        res.status(500).json({ error: detail });
    }
});

// --- Knowledge Base Health Check ---
adminRouter.get('/kb/health-check', async (req, res) => {
    try {
        const healthCheck = {
            status: 'checking',
            timestamp: new Date().toISOString(),
            checks: {}
        };

        // 1. Check pgvector extension (called 'vector' in Supabase)
        try {
            // Direct check if extension exists
            const { data: extCheck, error: extError } = await supabase
                .from('pg_extension')
                .select('extname')
                .eq('extname', 'vector')
                .single();
            
            if (extCheck && !extError) {
                healthCheck.checks.pgvector = { status: 'ok', message: 'vector extension is installed' };
            } else {
                // Fallback: Try to use the function
                try {
                    await supabase.rpc('match_document_chunks', {
                        query_embedding: new Array(1536).fill(0),
                        match_threshold: 0.1,
                        match_count: 1
                    });
                    healthCheck.checks.pgvector = { status: 'ok', message: 'vector extension is functional' };
                } catch (funcError) {
                    healthCheck.checks.pgvector = { 
                        status: 'error', 
                        message: 'vector extension not accessible. Check if enabled in Database > Extensions' 
                    };
                }
            }
        } catch (err) {
            // If we can't check directly, assume it's working if function exists
            healthCheck.checks.pgvector = { status: 'warning', message: 'Could not verify vector extension directly' };
        }

        // 2. Check document count
        const { count: docCount, error: docError } = await supabase
            .from('knowledge_base_documents')
            .select('*', { count: 'exact', head: true });
        healthCheck.checks.documents = {
            status: docError ? 'error' : 'ok',
            count: docCount || 0,
            message: docError ? docError.message : `${docCount || 0} documents in knowledge base`
        };

        // 3. Check chunk count
        const { count: chunkCount, error: chunkError } = await supabase
            .from('document_chunks')
            .select('*', { count: 'exact', head: true });
        healthCheck.checks.chunks = {
            status: chunkError ? 'error' : 'ok',
            count: chunkCount || 0,
            message: chunkError ? chunkError.message : `${chunkCount || 0} chunks indexed`
        };

        // 4. Test embedding generation
        try {
            const testEmbedding = await getEmbedding("test query for health check");
            healthCheck.checks.embeddings = {
                status: 'ok',
                message: 'OpenAI embedding generation working',
                dimensions: testEmbedding.length
            };
        } catch (err) {
            healthCheck.checks.embeddings = {
                status: 'error',
                message: `Embedding generation failed: ${err.message}`
            };
        }

        // 5. Test similarity search
        if (chunkCount > 0) {
            try {
                const testQuery = "health check test query";
                const embedding = await getEmbedding(testQuery);
                const { data: searchResults, error: searchError } = await supabase
                    .rpc('match_document_chunks', {
                        query_embedding: embedding,
                        match_threshold: 0.1, // Very low threshold for health check
                        match_count: 1
                    });
                
                healthCheck.checks.similarity_search = {
                    status: searchError ? 'error' : 'ok',
                    message: searchError ? searchError.message : 'Similarity search working',
                    results_found: searchResults ? searchResults.length : 0
                };
            } catch (err) {
                healthCheck.checks.similarity_search = {
                    status: 'error',
                    message: `Similarity search failed: ${err.message}`
                };
            }
        } else {
            healthCheck.checks.similarity_search = {
                status: 'warning',
                message: 'No chunks to search - upload documents first'
            };
        }

        // 6. Check KB configuration
        const { data: kbConfig } = await supabase
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'kb_retrieval_config')
            .single();
        healthCheck.checks.configuration = {
            status: kbConfig ? 'ok' : 'warning',
            message: kbConfig ? 'KB configuration found' : 'Using default configuration',
            config: kbConfig ? JSON.parse(kbConfig.setting_value) : null
        };

        // Overall status
        const statuses = Object.values(healthCheck.checks).map(c => c.status);
        if (statuses.includes('error')) {
            healthCheck.status = 'unhealthy';
        } else if (statuses.includes('warning')) {
            healthCheck.status = 'degraded';
        } else {
            healthCheck.status = 'healthy';
        }

        res.json(healthCheck);
    } catch (error) {
        console.error('KB health check error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Health check failed',
            error: error.message
        });
    }
});

// Test KB with a sample query
adminRouter.post('/kb/test-query', async (req, res) => {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query string is required' });
    }

    try {
        // Get KB config
        const { data: configData } = await supabase
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'kb_retrieval_config')
            .single();
        const kbConfig = configData ? JSON.parse(configData.setting_value) : { similarity_threshold: 0.78, max_chunks: 5 };

        // Generate embedding
        const startTime = Date.now();
        const queryEmbedding = await getEmbedding(query);
        const embeddingTime = Date.now() - startTime;

        // Search for similar chunks
        const { data: chunks, error: matchError } = await supabase.rpc('match_document_chunks', {
            query_embedding: queryEmbedding,
            match_threshold: kbConfig.similarity_threshold,
            match_count: kbConfig.max_chunks
        });
        const searchTime = Date.now() - startTime - embeddingTime;

        if (matchError) {
            throw new Error(`Search failed: ${matchError.message}`);
        }

        // Get document names
        const docIds = [...new Set((chunks || []).map(c => c.document_id))];
        const { data: docs } = await supabase
            .from('knowledge_base_documents')
            .select('id, file_name')
            .in('id', docIds);
        const docMap = docs ? Object.fromEntries(docs.map(d => [d.id, d.file_name])) : {};

        // Format results
        const results = (chunks || []).map((chunk, idx) => ({
            rank: idx + 1,
            similarity: chunk.similarity,
            document: docMap[chunk.document_id] || 'Unknown',
            metadata: chunk.metadata || {},
            text_preview: chunk.chunk_text.substring(0, 200) + '...'
        }));

        res.json({
            query,
            embedding_time_ms: embeddingTime,
            search_time_ms: searchTime,
            total_time_ms: Date.now() - startTime,
            chunks_found: results.length,
            similarity_threshold: kbConfig.similarity_threshold,
            results
        });
    } catch (error) {
        console.error('KB test query error:', error);
        res.status(500).json({
            error: 'Test query failed',
            message: error.message
        });
    }
});

// Get KB analytics statistics
adminRouter.get('/kb/analytics', async (req, res) => {
    const { days = 7 } = req.query;
    
    try {
        const { data, error } = await supabase.rpc('get_kb_usage_stats', {
            days_back: parseInt(days)
        });
        
        if (error) throw error;
        
        res.json({
            period_days: parseInt(days),
            stats: data[0] || {
                total_queries: 0,
                avg_chunks_found: 0,
                avg_chunks_used: 0,
                avg_similarity: 0,
                avg_response_time_ms: 0,
                top_sources: [],
                queries_per_day: {}
            }
        });
    } catch (error) {
        console.error('KB analytics error:', error);
        res.status(500).json({
            error: 'Failed to fetch KB analytics',
            message: error.message
        });
    }
});

// --- System Settings Routes for Admin ---

// Get the current Momi base prompt
adminRouter.get('/system-settings/momi-base-prompt', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'momi_base_prompt')
            .single();

        if (error) {
            if (error.code === 'PGRST116') { // PostgREST error code for "Resource not found"
                return res.status(404).json({ error: 'Momi base prompt setting not found.' });
            }
            throw error;
        }
        res.json({ momi_base_prompt: data.setting_value });
    } catch (error) {
        console.error('Error fetching Momi base prompt:', error);
        res.status(500).json({ error: 'Failed to fetch Momi base prompt', details: error.message });
    }
});

// Update the Momi base prompt
adminRouter.put('/system-settings/momi-base-prompt', async (req, res) => {
    const { new_prompt_value } = req.body;

    if (typeof new_prompt_value !== 'string' || new_prompt_value.trim() === '') {
        return res.status(400).json({ error: 'New prompt value is required and must be a non-empty string.' });
    }

    try {
        const { data, error } = await supabase
            .from('system_settings')
            .update({ setting_value: new_prompt_value, updated_at: new Date().toISOString() })
            .eq('setting_key', 'momi_base_prompt')
            .select()
            .single(); // Ensure it returns the updated record

        if (error) {
             if (error.code === 'PGRST116') { // If the setting key doesn't exist for some reason
                return res.status(404).json({ error: 'Momi base prompt setting not found to update.' });
            }
            throw error;
        }
        
        if (!data) { // Should not happen if no error and PGRST116 is handled, but as a safeguard
            return res.status(404).json({ error: 'Momi base prompt setting not found, update failed.' });
        }

        res.json({ message: 'Momi base prompt updated successfully.', updated_setting: data });
    } catch (error) {
        console.error('Error updating Momi base prompt:', error);
        res.status(500).json({ error: 'Failed to update Momi base prompt', details: error.message });
    }
});

// --- User Management Routes for Admin ---

// Get all registered users (from public.users and auth.users)
adminRouter.get('/users/registered', async (req, res) => {
    try {
        // Fetch from public.users. We can't directly join with auth.users easily via client SDK
        // in a single query for all users without more complex SQL or a view.
        // So, we'll fetch our user profiles first.
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, auth_user_id, email, created_at, profile_data')
            .order('created_at', { ascending: false });

        if (usersError) throw usersError;

        // For enrichment, you might fetch auth.users details separately if needed,
        // but this could be slow for many users. A simpler approach for now:
        // Or create a DB view/function that pre-joins this information.
        // Supabase admin API (not directly used by client SDK for this usually) might list auth users.
        // For now, we return what's in public.users and note that auth_user_id links them.

        res.json(users);
    } catch (error) {
        console.error('Error fetching registered users:', error);
        res.status(500).json({ error: 'Failed to fetch registered users', details: error.message });
    }
});

// Get all guest users
adminRouter.get('/users/guests', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('guest_users')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error fetching guest users:', error);
        res.status(500).json({ error: 'Failed to fetch guest users', details: error.message });
    }
});

// Get conversations for a specific registered user
adminRouter.get('/users/:userId/conversations', async (req, res) => {
    const { userId } = req.params;
    try {
        const { data, error } = await supabase
            .from('conversations')
            .select('*, user_id(email, id), guest_user_id(id)') // Example of joining
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error(`Error fetching conversations for user ${userId}:`, error);
        res.status(500).json({ error: 'Failed to fetch user conversations', details: error.message });
    }
});

// Get conversations for a specific guest user
adminRouter.get('/guests/:guestUserId/conversations', async (req, res) => {
    const { guestUserId } = req.params;
    try {
        const { data, error } = await supabase
            .from('conversations')
            .select('*')
            .eq('guest_user_id', guestUserId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error(`Error fetching conversations for guest ${guestUserId}:`, error);
        res.status(500).json({ error: 'Failed to fetch guest conversations', details: error.message });
    }
});

// Get messages for a specific conversation (admin version)
adminRouter.get('/conversations/:conversationId/messages', async (req, res) => {
    const { conversationId } = req.params;
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('timestamp', { ascending: true });
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error(`Error fetching messages for conversation ${conversationId}:`, error);
        res.status(500).json({ error: 'Failed to fetch messages', details: error.message });
    }
});

// --- Analytics Routes for Admin ---
adminRouter.get('/analytics/summary', async (req, res) => {
    try {
        // Total Registered Users
        const { count: totalRegisteredUsers, error: regUsersError } = await supabase
            .from('users')
            .select('* ', { count: 'exact', head: true });
        if (regUsersError) throw regUsersError;

        // Total Guest Users
        const { count: totalGuestUsers, error: guestUsersError } = await supabase
            .from('guest_users')
            .select('* ', { count: 'exact', head: true });
        if (guestUsersError) throw guestUsersError;

        // Total Conversations
        const { count: totalConversations, error: convosError } = await supabase
            .from('conversations')
            .select('* ', { count: 'exact', head: true });
        if (convosError) throw convosError;

        // Messages Today
        const todayStart = new Date(); // UTC start of today
        todayStart.setUTCHours(0, 0, 0, 0);
        const todayEnd = new Date(); // UTC end of today (or rather, start of tomorrow for < comparison)
        todayEnd.setUTCHours(23, 59, 59, 999);
        
        const { count: messagesToday, error: messagesError } = await supabase
            .from('messages')
            .select('* ', { count: 'exact', head: true })
            .gte('timestamp', todayStart.toISOString())
            .lte('timestamp', todayEnd.toISOString());
        if (messagesError) throw messagesError;

        res.json({
            totalRegisteredUsers: totalRegisteredUsers || 0,
            totalGuestUsers: totalGuestUsers || 0,
            totalConversations: totalConversations || 0,
            messagesToday: messagesToday || 0
        });

    } catch (error) {
        console.error('Error fetching analytics summary:', error);
        res.status(500).json({ error: 'Failed to fetch analytics summary', details: error.message });
    }
});

// New endpoint for messages over time
adminRouter.get('/analytics/messages-over-time', async (req, res) => {
    // Default to last 30 days
    const period = req.query.period || '30d'; 
    let startDate = new Date();

    if (period === '7d') {
        startDate.setDate(startDate.getDate() - 7);
    } else if (period === '30d') {
        startDate.setDate(startDate.getDate() - 30);
    } else {
        // Potentially support custom date ranges via req.query.startDate, req.query.endDate
        // For now, default to 30 days if period is unrecognized
        startDate.setDate(startDate.getDate() - 30);
    }
    startDate.setUTCHours(0, 0, 0, 0); // Start of the day UTC

    try {
        // This query is a bit simplified. For more complex grouping directly in Supabase
        // with just the client library, it can be tricky. 
        // A database function (RPC) would be more robust for daily counts.
        // This approach fetches messages and processes them in JS, which is less efficient for large data.

        const { data, error } = await supabase
            .from('messages')
            .select('timestamp')
            .gte('timestamp', startDate.toISOString())
            .order('timestamp', { ascending: true });

        if (error) throw error;

        // Process data to get daily counts
        const dailyCounts = {};
        data.forEach(msg => {
            const date = new Date(msg.timestamp).toISOString().split('T')[0]; // YYYY-MM-DD
            dailyCounts[date] = (dailyCounts[date] || 0) + 1;
        });

        // Convert to array format for charts
        const chartData = Object.keys(dailyCounts).map(date => ({
            date: date,
            count: dailyCounts[date]
        })).sort((a, b) => new Date(a.date) - new Date(b.date)); // Ensure sorted by date

        res.json(chartData);

    } catch (error) {
        console.error('Error fetching messages over time:', error);
        res.status(500).json({ error: 'Failed to fetch messages over time', details: error.message });
    }
});

// New endpoint for daily active users
adminRouter.get('/analytics/daily-active-users', async (req, res) => {
    const period = req.query.period || '30d'; 
    let startDate = new Date();
    if (period === '7d') {
        startDate.setDate(startDate.getDate() - 7);
    } else { // Default to 30 days
        startDate.setDate(startDate.getDate() - 30);
    }
    startDate.setUTCHours(0, 0, 0, 0); 

    try {
        // Fetch messages and include user_id and guest_user_id from the related conversation
        const { data, error } = await supabase
            .from('messages')
            .select('timestamp, conversations ( user_id, guest_user_id )') // Corrected select
            .gte('timestamp', startDate.toISOString())
            .order('timestamp', { ascending: true });

        if (error) throw error;

        const dailyActiveUsers = {}; // Store sets of unique user/guest IDs per day

        data.forEach(msg => {
            const date = new Date(msg.timestamp).toISOString().split('T')[0];
            if (!dailyActiveUsers[date]) {
                dailyActiveUsers[date] = new Set();
            }
            // Access user_id and guest_user_id from the nested conversations object
            let identifier = null;
            if (msg.conversations) { // Check if conversations data exists (it should based on select)
                identifier = msg.conversations.user_id ? `user_${msg.conversations.user_id}` : (msg.conversations.guest_user_id ? `guest_${msg.conversations.guest_user_id}` : null);
            }
            
            if (identifier) { // Ensure there is an identifier
                 dailyActiveUsers[date].add(identifier);
            }
        });

        const chartData = Object.keys(dailyActiveUsers).map(date => ({
            date: date,
            count: dailyActiveUsers[date].size // Count of unique users for that day
        })).sort((a, b) => new Date(a.date) - new Date(b.date));

        res.json(chartData);

    } catch (error) {
        console.error('Error fetching daily active users:', error);
        res.status(500).json({ error: 'Failed to fetch daily active users', details: error.message });
    }
});

// Delete a specific guest user and all their associated data
adminRouter.delete('/guests/:guestId', async (req, res) => {
    const { guestId } = req.params;
    if (!guestId) {
        return res.status(400).json({ error: 'Guest ID is required.' });
    }

    try {
        // Step 1: Get all conversation IDs for the guest user
        const { data: conversations, error: convError } = await supabase
            .from('conversations')
            .select('id')
            .eq('guest_user_id', guestId);

        if (convError) {
            console.error(`Error fetching conversations for guest ${guestId}:`, convError.message);
            throw new Error(`Failed to fetch conversations for guest: ${convError.message}`);
        }

        if (conversations && conversations.length > 0) {
            const conversationIds = conversations.map(c => c.id);

            // Step 2: Delete messages for those conversations
            const { error: messagesError } = await supabase
                .from('messages')
                .delete()
                .in('conversation_id', conversationIds);

            if (messagesError) {
                console.error(`Error deleting messages for conversations of guest ${guestId}:`, messagesError.message);
                throw new Error(`Failed to delete messages for guest's conversations: ${messagesError.message}`);
            }

            // Step 3: Delete those conversations
            const { error: convDeleteError } = await supabase
                .from('conversations')
                .delete()
                .in('id', conversationIds);

            if (convDeleteError) {
                console.error(`Error deleting conversations for guest ${guestId}:`, convDeleteError.message);
                throw new Error(`Failed to delete conversations for guest: ${convDeleteError.message}`);
            }
        }

        // Step 4: Delete the guest user
        const { data: guestData, error: guestDeleteError } = await supabase
            .from('guest_users')
            .delete()
            .eq('id', guestId)
            .select()
            .single();

        if (guestDeleteError) {
            console.error(`Error deleting guest user ${guestId}:`, guestDeleteError.message);
            throw new Error(`Failed to delete guest user: ${guestDeleteError.message}`);
        }

        if (!guestData) {
            return res.status(404).json({ message: 'Guest user not found.' });
        }

        res.status(200).json({ 
            message: `Guest user (ID: ${guestId}) and all associated data deleted successfully.`,
            deletedGuest: guestData
        });

    } catch (error) {
        console.error(`Error in delete guest user endpoint for ID ${guestId}:`, error);
        res.status(500).json({ error: error.message || 'Internal server error during guest user deletion.' });
    }
});

// Delete a specific conversation and its messages
adminRouter.delete('/conversations/:conversationId', async (req, res) => {
    const { conversationId } = req.params;
    if (!conversationId) {
        return res.status(400).json({ error: 'Conversation ID is required.' });
    }

    try {
        // Step 1: Delete messages for the conversation
        const { error: messagesError } = await supabase
            .from('messages')
            .delete()
            .eq('conversation_id', conversationId);

        if (messagesError) {
            console.error(`Error deleting messages for conversation ${conversationId}:`, messagesError.message);
            throw new Error(`Failed to delete messages for conversation: ${messagesError.message}`);
        }

        // Step 2: Delete the conversation itself
        const { data: convData, error: convDeleteError } = await supabase
            .from('conversations')
            .delete()
            .eq('id', conversationId)
            .select()
            .single();

        if (convDeleteError) {
            console.error(`Error deleting conversation ${conversationId}:`, convDeleteError.message);
            throw new Error(`Failed to delete conversation: ${convDeleteError.message}`);
        }

        if (!convData) {
            return res.status(404).json({ message: 'Conversation not found.' });
        }

        res.status(200).json({ 
            message: `Conversation (ID: ${conversationId}) and its messages deleted successfully.`,
            deletedConversation: convData
        });

    } catch (error) {
        console.error(`Error in delete conversation endpoint for ID ${conversationId}:`, error);
        res.status(500).json({ error: error.message || 'Internal server error during conversation deletion.' });
    }
});

// Mount the admin router under /api/admin
app.use('/api/admin', adminRouter); // Re-enabled admin API routes

// --- Image Upload Route ---
app.post('/api/chat/upload', imageUpload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image file provided.' });
    }
    if (!supabaseServiceKey) {
        return res.status(500).json({ error: 'File uploads are not configured on the server (missing service key).' });
    }

    try {
        const fileName = `${crypto.randomBytes(16).toString('hex')}${path.extname(req.file.originalname)}`;
        const filePath = `chat_images/${fileName}`; // Define a path/bucket in Supabase Storage

        const { data, error: uploadError } = await supabase.storage
            .from('momi-uploads') // Make sure this bucket exists in your Supabase Storage and has appropriate policies
            .upload(filePath, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false
            });

        if (uploadError) throw uploadError;

        // Get public URL (ensure your bucket has appropriate RLS for public reads or create signed URLs)
        const { data: publicUrlData } = supabase.storage
            .from('momi-uploads')
            .getPublicUrl(filePath);

        if (!publicUrlData || !publicUrlData.publicUrl) {
            throw new Error('Could not get public URL for uploaded image.');
        }
        
        res.json({ imageUrl: publicUrlData.publicUrl, filePath: data.path });

    } catch (error) {
        console.error('Error uploading image to Supabase. Full error object:', JSON.stringify(error, null, 2));
        let errorDetails = error.message;
        if (error.data && error.data.message) { // Supabase specific error structure
            errorDetails = error.data.message;
        } else if (error.response && error.response.data && error.response.data.message) { // Axios-like error structure
            errorDetails = error.response.data.message;
        }
        console.error('Extracted error details for response:', errorDetails);
        res.status(500).json({ error: 'Failed to upload image', details: errorDetails });
    }
});

// --- Speech-to-Text Route ---
app.post('/api/chat/speech-to-text', audioUpload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided.' });
    }
    try {
        // req.file.path is where multer saved the audio file
        const transcription = await openai.audio.transcriptions.create({
            model: "whisper-1",
            file: fs.createReadStream(req.file.path),
            language: "en" // Specify English language
        });

        // Clean up the temporarily saved audio file
        fs.unlink(req.file.path, (err) => {
            if (err) console.error("Error deleting temporary audio file:", err);
        });

        res.json({ transcript: transcription.text });

    } catch (error) {
        console.error('Error with OpenAI speech-to-text:', error);
        // Clean up file even on error
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting temporary audio file after error:", err);
            });
        }
        res.status(500).json({ error: 'Speech-to-text transcription failed', details: error.message });
    }
});

// --- Guest User Routes ---
app.post('/api/guest/session', async (req, res) => {
    try {
        const sessionToken = crypto.randomBytes(32).toString('hex');
        const { data, error } = await supabase
            .from('guest_users')
            .insert([{ session_token: sessionToken }])
            .select()
            .single();

        if (error) throw error;
        res.json({ guestUserId: data.id, sessionToken: data.session_token });
    } catch (error) {
        console.error('Error creating guest session:', error);
        res.status(500).json({ error: 'Could not create guest session', details: error.message });
    }
});

// --- Auth Routes (interfacing with Supabase Auth) ---
// Note: Actual user registration/login should primarily happen on the client-side using supabase-js,
// which securely handles auth with Supabase. These backend routes are for any server-side logic
// needed post-authentication or for creating corresponding records in your public.users table.

app.post('/api/auth/register', async (req, res) => {
    const { email, auth_user_id, profileData } = req.body;
    if (!email || !auth_user_id) {
        return res.status(400).json({ error: 'Email and auth_user_id are required.' });
    }

    try {
        // 1. Create user in Supabase Auth (typically client-side, but can be admin action)
        // For this example, we assume client handles Supabase Auth user creation.
        // This endpoint is more about creating the corresponding public.users record.
        // Or, if you have a valid session JWT from the client, you can get the user.
        
        // Example: if you were to create a user from backend (requires admin privileges usually)
        // const { data: authData, error: authError } = await supabase.auth.admin.createUser({ email, password });
        // if (authError) throw authError;
        // const authUserId = authData.user.id;

        // For now, let's assume we receive auth_user_id after client-side registration
        if (!auth_user_id) {
             return res.status(400).json({ error: 'auth_user_id is required after client-side Supabase registration.' })
        }

        // 2. Create user in our public.users table
        const { data: publicUser, error: publicUserError } = await supabase
            .from('users')
            .insert([{ auth_user_id, email, profile_data: profileData || {} }])
            .select()
            .single();

        if (publicUserError) throw publicUserError;

        res.status(201).json({ message: 'User profile created successfully', user: publicUser });

    } catch (error) {
        console.error('Error in user registration synchronization:', error);
        res.status(500).json({ error: 'User registration synchronization failed', details: error.message });
    }
});

// --- Chat Routes ---
app.post('/api/chat/message', async (req, res) => {
    const { conversationId, message, userId, guestUserId: initialGuestUserId, imageUrl } = req.body;
    let currentConversationId = conversationId;
    let currentGuestUserId = initialGuestUserId;
    let newGuestCreated = false;

    if (!message && !imageUrl) {
        return res.status(400).json({ error: 'Message or image URL is required.' });
    }
    if (!userId && !currentGuestUserId) {
        return res.status(400).json({ error: 'User ID or Guest User ID is required.' });
    }

    try {
        // Validate or create guest user if guestUserId is provided
        if (currentGuestUserId && !userId) {
            const { data: existingGuest, error: guestCheckError } = await supabase
                .from('guest_users')
                .select('id')
                .eq('id', currentGuestUserId)
                .single();

            if (guestCheckError || !existingGuest) {
                console.warn(`Guest user ${currentGuestUserId} not found or error checking. Creating a new one. Error: ${guestCheckError?.message}`);
                // Create a new guest session
                const sessionToken = crypto.randomBytes(32).toString('hex');
                const { data: newGuest, error: newGuestError } = await supabase
                    .from('guest_users')
                    .insert([{ session_token: sessionToken }])
                    .select('id, session_token')
                    .single();
                
                if (newGuestError) {
                    console.error('Failed to create a new guest user fallback:', newGuestError);
                    throw new Error('Failed to establish a valid guest session.');
                }
                currentGuestUserId = newGuest.id;
                newGuestCreated = true; // Flag that a new guest was created
                console.log('Created new fallback guest session:', { guestUserId: newGuest.id });
            }
        }

        // Get user identifier for conversation state
        const userIdentifier = userId || currentGuestUserId;
        
        // Get conversation state
        const state = conversationState.getState(userIdentifier);
        
        // Check if user wants to start the quiz
        if (message && message.toLowerCase().trim() === 'start nervous system quiz') {
            // Redirect to quiz start
            const quizReq = { body: { userId, guestUserId: currentGuestUserId } };
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
            // Redirect to quiz answer
            const quizReq = { 
                body: { 
                    userId, 
                    guestUserId: currentGuestUserId,
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
        
        // Determine user status if not set
        if (state.user_status === 'first_time' && !state.is_first_message) {
            // This means state exists but user_status might need updating
            state.user_status = await determineUserStatus(userIdentifier);
            conversationState.updateState(userIdentifier, { user_status: state.user_status });
        }

        // Handle first message greeting
        let finalUserMessage = message;
        if (state.is_first_message && !imageUrl) { // Only add greeting for text messages
            const greeting = selectGreeting(state, message);
            
            // Concatenate greeting with user message
            finalUserMessage = greeting + "\n\n" + message;
            
            // Update state
            conversationState.updateState(userIdentifier, {
                is_first_message: false,
                greetings_shown: [...state.greetings_shown, greeting],
                previous_greeting: greeting,
                last_context: message
            });
            
            console.log(`First message greeting for ${userIdentifier}: ${greeting}`);
        } else {
            // Update context for non-first messages
            conversationState.updateState(userIdentifier, {
                last_context: message
            });
        }

        // 1. Create conversation if it doesn't exist
        if (!currentConversationId) {
            // Use the potentially updated currentGuestUserId
            const convPayload = userId ? { user_id: userId } : { guest_user_id: currentGuestUserId };
            const { data: newConversation, error: convError } = await supabase
                .from('conversations')
                .insert([convPayload])
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
            content: imageUrl ? imageUrl : message, // Store original message, not with greeting
            metadata: imageUrl ? { original_user_prompt: message, is_image_request: true } : {}
        };
        const { error: userMessageError } = await supabase.from('messages').insert([userMessagePayload]);
        if (userMessageError) throw userMessageError;

        // RAG: Retrieve relevant context based on the user's message
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
        
        if (message && !imageUrl) { // Only do RAG for text messages for now
            try {
                const startTime = Date.now();
                const queryEmbedding = await getEmbedding(message);
                const embeddingTime = Date.now() - startTime;
                
                const { data: chunks, error: matchError } = await supabase.rpc('match_document_chunks', {
                    query_embedding: queryEmbedding,
                    match_threshold: kbConfig.similarity_threshold,
                    match_count: kbConfig.max_chunks
                });
                const retrievalTime = Date.now() - startTime - embeddingTime;

                if (matchError) {
                    console.error("Error matching document chunks:", matchError.message);
                } else if (kbConfig.debug_mode) {
                    console.log(`\n🔍 Knowledge Base Retrieval Debug:`);
                    console.log(`   Query: "${message}"`);
                    console.log(`   Embedding time: ${embeddingTime}ms`);
                    console.log(`   Retrieval time: ${retrievalTime}ms`);
                    console.log(`   Chunks found: ${chunks ? chunks.length : 0}`);
                    console.log(`   Similarity threshold: ${kbConfig.similarity_threshold}`);
                }
                
                if (chunks && chunks.length > 0) {
                    // Sort by similarity and take top chunks based on config
                    const topChunks = chunks.sort((a, b) => b.similarity - a.similarity).slice(0, kbConfig.use_top_chunks);
                    
                    // Enhanced debug logging with metadata
                    if (kbConfig.debug_mode) {
                        console.log(`\n📚 Knowledge Base Chunks Analysis:`);
                        console.log(`   Total chunks found: ${chunks.length}`);
                        console.log(`   Using top ${kbConfig.use_top_chunks} chunks`);
                        console.log(`   Similarity range: ${chunks[0].similarity.toFixed(4)} - ${chunks[chunks.length-1].similarity.toFixed(4)}`);
                        
                        console.log(`\n📄 Selected Chunks:`);
                        topChunks.forEach((chunk, idx) => {
                            const metadata = chunk.metadata || {};
                            console.log(`\n   ${idx + 1}. ${metadata.fileName || 'Unknown Document'}`);
                            console.log(`      - Similarity: ${chunk.similarity.toFixed(4)} ${chunk.similarity >= 0.9 ? '🟢' : chunk.similarity >= 0.8 ? '🟡' : '🟠'}`);
                            console.log(`      - Chunk: ${metadata.chunkIndex !== undefined ? metadata.chunkIndex + 1 : 'N/A'}/${metadata.totalChunks || '?'}`);
                            console.log(`      - Size: ${chunk.chunk_text.length} chars`);
                            console.log(`      - Preview: "${chunk.chunk_text.substring(0, 150).replace(/\n/g, ' ')}..."`);
                        });
                    }
                    
                    // Fetch document names for source attribution
                    const docIds = [...new Set(topChunks.map(c => c.document_id))];
                    const { data: docs } = await supabase
                        .from('knowledge_base_documents')
                        .select('id, file_name')
                        .in('id', docIds);
                    
                    const docMap = docs ? Object.fromEntries(docs.map(d => [d.id, d.file_name])) : {};
                    
                    // Build context with source comments and metadata
                    ragContext = topChunks.map((chunk, idx) => {
                        const fileName = docMap[chunk.document_id] || 'Unknown Document';
                        const metadata = chunk.metadata || {};
                        
                        // Create more detailed source comment
                        let sourceComment = `<!-- Source: ${fileName}`;
                        if (metadata.chunkIndex !== undefined) {
                            sourceComment += ` (Chunk ${metadata.chunkIndex + 1}/${metadata.totalChunks || '?'})`;
                        }
                        if (metadata.page && metadata.page !== 'N/A') {
                            sourceComment += ` Page: ${metadata.page}`;
                        }
                        sourceComment += ` -->`;
                        
                        return `${sourceComment}\n${chunk.chunk_text}`;
                    }).join("\n\n---\n\n");
                    
                    ragSources = topChunks.map(chunk => ({
                        fileName: docMap[chunk.document_id] || 'Unknown',
                        similarity: chunk.similarity,
                        metadata: chunk.metadata || {}
                    }));
                    
                    // Track KB usage analytics
                    try {
                        const { data: analyticsEnabled } = await supabase
                            .from('system_settings')
                            .select('setting_value')
                            .eq('setting_key', 'kb_analytics_enabled')
                            .single();
                            
                        if (analyticsEnabled && analyticsEnabled.setting_value === 'true') {
                            const kbUsageData = {
                                query: message.substring(0, 200), // Truncate for privacy
                                chunks_found: chunks.length,
                                chunks_used: topChunks.length,
                                avg_similarity: topChunks.reduce((sum, c) => sum + c.similarity, 0) / topChunks.length,
                                sources: ragSources.map(s => s.fileName),
                                timestamp: new Date().toISOString()
                            };
                            
                            // Save to analytics table
                            try {
                                const { data: trackingResult, error: trackingError } = await supabase.rpc('track_kb_query', {
                                    p_query_text: message,
                                    p_conversation_id: currentConversationId,
                                    p_chunks_found: chunks.length,
                                    p_chunks_used: topChunks.length,
                                    p_avg_similarity: kbUsageData.avg_similarity,
                                    p_sources: kbUsageData.sources,
                                    p_embedding_time_ms: embeddingTime,
                                    p_retrieval_time_ms: retrievalTime,
                                    p_total_time_ms: Date.now() - startTime,
                                    p_metadata: {
                                        user_type: userId ? 'registered' : 'guest',
                                        threshold_used: kbConfig.similarity_threshold
                                    }
                                });
                                
                                if (trackingError) {
                                    console.error("KB analytics tracking error:", trackingError);
                                } else if (kbConfig.debug_mode) {
                                    console.log('\n📊 KB Usage tracked:', trackingResult);
                                }
                            } catch (trackingError) {
                                console.error("KB analytics tracking failed:", trackingError);
                            }
                            
                            if (kbConfig.debug_mode) {
                                console.log('\n📊 KB Usage Analytics:', kbUsageData);
                            }
                        }
                    } catch (analyticsError) {
                        // Don't let analytics errors affect the main flow
                        console.error("Analytics tracking error:", analyticsError);
                    }
                }
            } catch (ragError) {
                console.error("Error during RAG retrieval:", ragError.message);
            }
        }

        // 3. Prepare context for OpenAI (fetch recent messages)
        const { data: recentMessages, error: historyError } = await supabase
            .from('messages')
            .select('sender_type, content, content_type, metadata')
            .eq('conversation_id', currentConversationId)
            .order('timestamp', { ascending: true })
            .limit(10); // Keep context window manageable
        if (historyError) throw historyError;

        // Get MOMI system prompt
        const momiBasePrompt = await getMomiBasePrompt();
        
        // Build system prompt with RAG context if available
        let systemPrompt = momiBasePrompt;
        if (ragContext) {
            systemPrompt = `${momiBasePrompt}\n\nRelevant information from knowledge base:\n${ragContext}\n\nUse this information to provide accurate and helpful responses when relevant.`;
        }

        // Map historical messages to OpenAI format, converting past images to text placeholders
        const historicalOpenAIMessages = recentMessages.map(msg => {
            let openAiMsgContent;
            if (msg.content_type === 'image_url') {
                // Represent historical images as text placeholders
                openAiMsgContent = `[User sent an image: ${msg.metadata?.original_user_prompt || 'User uploaded an image.'}]`;
            } else {
                openAiMsgContent = msg.content; // Text message from history or MOMi
            }
            return {
                role: msg.sender_type === 'momi' ? 'assistant' : 'user',
                content: openAiMsgContent
            };
        });

        // IMPORTANT: Always start with system prompt
        const openAIMessages = [
            { role: "system", content: systemPrompt },
            ...historicalOpenAIMessages
        ];

        // Add current user's message (text and/or image) as the last message
        let currentUserMessageContent = [];
        if (imageUrl) { // Current message includes an image
            try {
                const dataUri = await imageUrlToDataUri(imageUrl);
                currentUserMessageContent.push({ type: "image_url", image_url: { url: dataUri } });
                // Add the text part of the message if it exists
                if (message) {
                    currentUserMessageContent.push({ type: "text", text: message });
                } else {
                    // If only image is sent, add a default text part if your model requires it
                    // or ensure your logic handles image-only inputs if supported.
                    // For gpt-4o, it's good practice to have a text part, even if minimal.
                    currentUserMessageContent.push({ type: "text", text: "Describe this image." });
                }
            } catch (conversionError) {
                console.error("Error converting current user image to data URI:", conversionError.message);
                // Fallback: send text message indicating image error
                const fallbackText = message ? `[Image upload failed] ${message}` : "[Image upload failed]";
                currentUserMessageContent.push({ type: "text", text: fallbackText });
            }
        } else if (finalUserMessage) { // Current message is text-only (use finalUserMessage which includes greeting if first message)
            currentUserMessageContent.push({ type: "text", text: finalUserMessage });
        }
        
        // Only add user message if there's content for it
        if (currentUserMessageContent.length > 0) {
            // If image was processed, content is an array. If only text, it should be a string.
            // GPT-4o (and vision models) expect the 'content' for image messages to be an array.
            // For text-only messages, 'content' should be a string.
            if (imageUrl && currentUserMessageContent.some(part => part.type === 'image_url')) {
                 openAIMessages.push({ role: "user", content: currentUserMessageContent });
            } else if (finalUserMessage) { // Text only, ensure content is a string
                 openAIMessages.push({ role: "user", content: finalUserMessage });
            }
        }
        
        if (kbConfig.debug_mode) {
            console.log("\n🤖 Sending to OpenAI:");
            console.log("   System prompt length:", systemPrompt.length, "chars");
            console.log("   RAG context included:", ragContext.length > 0 ? 'Yes' : 'No');
            if (ragSources.length > 0) {
                console.log("   KB sources used:", ragSources.map(s => s.fileName).join(', '));
                console.log("   Average similarity:", (ragSources.reduce((sum, s) => sum + s.similarity, 0) / ragSources.length).toFixed(3));
            }
        }

        // 4. Call OpenAI API
        const completion = await openai.chat.completions.create({
            model: imageUrl ? "gpt-4o" : "gpt-3.5-turbo",
            messages: openAIMessages,
            max_tokens: imageUrl ? 500 : (ragContext ? 400 : 150) 
        });

        const momiResponseText = completion.choices[0].message.content;

        // 5. Store MOMi's response
        const momiMessagePayload = {
            conversation_id: currentConversationId,
            sender_type: 'momi',
            content_type: 'text',
            content: momiResponseText,
            openai_message_id: completion.id
        };
        const { error: momiMessageError } = await supabase.from('messages').insert([momiMessagePayload]);
        if (momiMessageError) throw momiMessageError;

        const responsePayload = { 
            reply: momiResponseText, 
            conversationId: currentConversationId 
        };

        if (newGuestCreated && currentGuestUserId) {
            // If a new guest was created, we need to send back the new guestUserId and sessionToken
            // The client needs the sessionToken to store it, although for this specific flow, only guestUserId is used by /api/chat/message
            // Fetching the session_token for the newly created guest to be complete
             const { data: guestDetails, error: guestDetailError } = await supabase
                .from('guest_users')
                .select('session_token')
                .eq('id', currentGuestUserId)
                .single();

            if (guestDetailError || !guestDetails) {
                console.error('Could not retrieve session token for newly created guest:', currentGuestUserId, guestDetailError);
                // Not critical for chat to continue, but client won't be able to update localStorage correctly
            } else {
                 responsePayload.newGuestSession = {
                    guestUserId: currentGuestUserId,
                    sessionToken: guestDetails.session_token 
                };
            }
        }

        res.json(responsePayload);

    } catch (error) {
        console.error('Error processing chat message:', error);
        res.status(500).json({ error: 'Failed to process chat message', details: error.message });
    }
});

app.get('/api/chat/history/:conversationId', async (req, res) => {
    const { conversationId } = req.params;
    // TODO: Add authentication/authorization to ensure user can only access their own history
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('timestamp', { ascending: true });
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ error: 'Failed to fetch chat history', details: error.message });
    }
});

// Reset session endpoint
app.post('/api/reset-session', async (req, res) => {
    const { userId, guestUserId } = req.body;
    
    if (!userId && !guestUserId) {
        return res.status(400).json({ error: 'User ID or Guest User ID is required.' });
    }
    
    const userIdentifier = userId || guestUserId;
    
    try {
        // Reset the conversation state
        const wasReset = conversationState.resetState(userIdentifier);
        
        if (wasReset) {
            console.log(`Session reset for user: ${userIdentifier}`);
            res.json({ 
                success: true, 
                message: 'Session state has been reset successfully.',
                userId: userIdentifier 
            });
        } else {
            res.json({ 
                success: true, 
                message: 'No active session found to reset.',
                userId: userIdentifier 
            });
        }
    } catch (error) {
        console.error('Error resetting session:', error);
        res.status(500).json({ error: 'Failed to reset session', details: error.message });
    }
});

// --- Quiz Routes ---
app.post('/api/quiz/start', startQuiz);
app.post('/api/quiz/answer', answerQuiz);
app.post('/api/quiz/status', getQuizStatus);

// New route for the full-page chat widget
app.get('/widget/fullpage', (req, res) => {
    // We assume fullpage.html is in the same directory as index.js
    res.sendFile(path.join(__dirname, 'fullpage.html'));
});

// --- Root and Test Routes (keep for basic checks) ---
app.get('/', (req, res) => {
    res.send('MOMi Backend is running!');
});
app.get('/api/test', (req, res) => {
    res.json({ message: 'Test route is working! Supra client: ' + (supabase ? 'OK' : 'FAIL') + ', OpenAI client: ' + (openai ? 'OK' : 'FAIL'), serviceKeySet: !!supabaseServiceKey });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`\n🚀 MOMi Backend Server Started Successfully!`);
    console.log(`====================================`);
    console.log(`📍 Server URL: http://0.0.0.0:${port}`);
    console.log(`📅 Started at: ${new Date().toISOString()}`);
    console.log(`\n🔧 Configuration Status:`);
    console.log(`   - Supabase Client: ${supabase ? '✅ Connected' : '❌ Not Connected'}`);
    console.log(`   - OpenAI Client: ${openai ? '✅ Connected' : '❌ Not Connected'}`);
    console.log(`   - Service Key: ${supabaseServiceKey ? '✅ Set' : '⚠️  Not Set (File uploads may fail)'}`);
    console.log(`   - Admin Routes: ✅ Protected at /api/admin/*`);
    console.log(`   - CORS: ✅ Enabled for all origins`);
    console.log(`\n📚 RAG System:`);
    console.log(`   - Document Upload: /api/admin/rag/upload-document`);
    console.log(`   - Similarity Threshold: 0.82`);
    console.log(`   - Chunk Size: 1500 chars (150 overlap)`);
    console.log(`   - Metadata Tracking: ✅ Enabled`);
    console.log(`\n🎯 Features Active:`);
    console.log(`   - Guest Sessions: ✅`);
    console.log(`   - Image Support: ✅`);
    console.log(`   - Voice Input: ✅`);
    console.log(`   - Conversation State: ✅`);
    console.log(`   - Resilient Reset Quiz: ✅`);
    console.log(`====================================\n`);
}); 