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
const landingPath = path.join(__dirname, '../frontend_landing');
app.use(express.static(landingPath));

// Serve Admin Panel (from momi_project/frontend_admin/dist)
// All /admin/* routes should serve the admin panel's index.html for client-side routing
const adminDistPath = path.join(__dirname, '../frontend_admin/dist');
app.use('/admin', express.static(adminDistPath));
app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(adminDistPath, 'index.html'));
});

// ADDING A MORE SPECIFIC ROUTE FOR WIDGET ASSETS
const widgetAssetsPath = path.join(__dirname, '../frontend_widget/dist/assets');
app.use('/widget/assets', express.static(widgetAssetsPath));

// Serve Chat Widget static assets (from momi_project/frontend_widget/dist)
const widgetDistPath = path.join(__dirname, '../frontend_widget/dist');
app.use('/widget', express.static(widgetDistPath));

// Serve Widget HTML Page Route
app.get('/widget/fullpage', (req, res) => {
    res.sendFile(path.join(__dirname, 'fullpage.html'));
});

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
        for (const chunk of chunks) {
            if (chunk.trim().length < 10) continue;
            try {
                const embedding = await getEmbedding(chunk);
                const { error: chunkError } = await supabase
                    .from('document_chunks')
                    .insert({ document_id: documentId, chunk_text: chunk, embedding: embedding });
                if (chunkError) {
                    console.error(`Failed to store chunk for doc ${documentId}:`, chunkError.message);
                    continue;
                }
                processedChunks++;
            } catch(embeddingError){
                 console.error(`Failed to get embedding for a chunk of doc ${documentId}:`, embeddingError.message);
            }
        }
        
        await supabase.from('knowledge_base_documents').update({ last_indexed_at: new Date().toISOString() }).eq('id', documentId);

        res.status(201).json({ 
            message: `Document uploaded and processed. ${processedChunks} chunks created.`, 
            documentId: documentId,
            fileName: req.file.originalname
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
            message: `Document (ID: ${guestId}) and its associated conversations deleted successfully.`,
            deletedGuest: guestData
        });

    } catch (error) {
        console.error(`Error in delete guest user endpoint for ID ${guestId}:`, error);
        // Check if the error message already contains specifics from Supabase errors
        const detail = error.message.includes('Failed to delete') ? error.message : 'Internal server error during guest user deletion.';
        res.status(500).json({ error: detail });
    }
});

// --- Root and Catch-all Routes ---
app.get('/api/test', (req, res) => {
    res.json({ message: 'Test route is working' });
});

// IMPORTANT: This must be the LAST route so it doesn't override API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(landingPath, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening at http://0.0.0.0:${port}`);
});
