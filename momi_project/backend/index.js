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

const app = express();
const port = process.env.PORT || 3001;

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
    const { conversationId, message, userId, guestUserId, imageUrl } = req.body;
    let currentConversationId = conversationId;

    if (!message && !imageUrl) {
        return res.status(400).json({ error: 'Message or image URL is required.' });
    }
    if (!userId && !guestUserId) {
        return res.status(400).json({ error: 'User ID or Guest User ID is required.' });
    }

    try {
        // 1. Create conversation if it doesn't exist
        if (!currentConversationId) {
            const convPayload = userId ? { user_id: userId } : { guest_user_id: guestUserId };
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
            content: imageUrl ? imageUrl : message,
            metadata: imageUrl ? { original_user_prompt: message, is_image_request: true } : {}
        };
        const { error: userMessageError } = await supabase.from('messages').insert([userMessagePayload]);
        if (userMessageError) throw userMessageError;

        // RAG: Retrieve relevant context based on the user's message
        let ragContext = '';
        if (message && !imageUrl) { // Only do RAG for text messages for now
            try {
                const queryEmbedding = await getEmbedding(message);
                const { data: chunks, error: matchError } = await supabase.rpc('match_document_chunks', {
                    query_embedding: queryEmbedding,
                    match_threshold: 0.75, // Adjust as needed
                    match_count: 3       // Adjust as needed
                });

                if (matchError) console.error("Error matching document chunks:", matchError.message);
                
                if (chunks && chunks.length > 0) {
                    ragContext = chunks.map(chunk => chunk.chunk_text).join("\n\n---\n\n");
                    console.log("Retrieved RAG context:", ragContext.substring(0,200) + "...");
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

        const momiBasePrompt = await getMomiBasePrompt();
        let systemPrompt = momiBasePrompt;
        if (ragContext) {
            systemPrompt = `You are MOMi, a friendly and empathetic assistant. Relevant information from documents: \n${ragContext}\n\nBased on this information and your general knowledge, please answer the user\'s question. If the information isn\'t relevant, rely on your general knowledge. Original base prompt: ${momiBasePrompt}`;
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
        } else if (message) { // Current message is text-only
            currentUserMessageContent.push({ type: "text", text: message });
        }
        
        // Only add user message if there's content for it
        if (currentUserMessageContent.length > 0) {
            // If image was processed, content is an array. If only text, it should be a string.
            // GPT-4o (and vision models) expect the 'content' for image messages to be an array.
            // For text-only messages, 'content' should be a string.
            if (imageUrl && currentUserMessageContent.some(part => part.type === 'image_url')) {
                 openAIMessages.push({ role: "user", content: currentUserMessageContent });
            } else if (message) { // Text only, ensure content is a string
                 openAIMessages.push({ role: "user", content: message });
            }
        }
        
        console.log("Sending to OpenAI. Last user message content parts:", JSON.stringify(currentUserMessageContent, null, 2));

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

        res.json({ 
            reply: momiResponseText, 
            conversationId: currentConversationId 
        });

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


// --- Root and Test Routes (keep for basic checks) ---
app.get('/', (req, res) => {
    res.send('MOMi Backend is running!');
});
app.get('/api/test', (req, res) => {
    res.json({ message: 'Test route is working! Supra client: ' + (supabase ? 'OK' : 'FAIL') + ', OpenAI client: ' + (openai ? 'OK' : 'FAIL'), serviceKeySet: !!supabaseServiceKey });
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
}); 