import { useState, useEffect } from 'react';
import axios from 'axios';
import supabase from './supabaseClient'; // Ensure this is correctly configured
import ChatWindow from './components/ChatWindow';
import './App.css';

// Set the base URL for all Axios requests
axios.defaults.baseURL = 'https://momis-project.replit.app'; // Your deployed backend URL

function App({ mode = 'floating' }) {
    const [isOpen, setIsOpen] = useState(mode === 'fullpage');
    const [messages, setMessages] = useState([]);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState(null);
    const [conversationId, setConversationId] = useState(null);
    const [guestUserId, setGuestUserId] = useState(null);
    const [isInitializing, setIsInitializing] = useState(true);

    useEffect(() => {
        const initializeSession = async () => {
            let storedGuestId = localStorage.getItem('momiGuestUserId');
            if (storedGuestId) {
                setGuestUserId(storedGuestId);
            } else {
                try {
                    const { data } = await axios.post('/api/guest/session');
                    if (data.guestUserId) {
                        localStorage.setItem('momiGuestUserId', data.guestUserId);
                        setGuestUserId(data.guestUserId);
                    }
                } catch (err) {
                    setError('Could not initialize session.');
                    console.error('Failed to create guest session:', err);
                }
            }
            setIsInitializing(false);
        };

        initializeSession();
    }, []);
    
    // Function to handle sending messages
    const handleSendMessage = async (message, imageUrl = null) => {
        if ((!message || message.trim() === '') && !imageUrl) return;

        const userMessage = { sender_type: 'user', content: message, content_type: imageUrl ? 'image_url' : 'text', timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, userMessage]);
        setIsSending(true);
        setError(null);

        try {
            const payload = {
                message,
                imageUrl,
                conversationId,
                guestUserId
            };

            const { data } = await axios.post('/api/chat/message', payload);

            const momiMessage = { sender_type: 'momi', content: data.reply, timestamp: new Date().toISOString() };
            setMessages(prev => [...prev, momiMessage]);

            if (data.conversationId && !conversationId) {
                setConversationId(data.conversationId);
            }
            if (data.newGuestSession) {
                setGuestUserId(data.newGuestSession.guestUserId);
                localStorage.setItem('momiGuestUserId', data.newGuestSession.guestUserId);
            }
        } catch (err) {
            const errorMessage = err.response?.data?.details || 'Failed to send message.';
            setError(errorMessage);
            const errorMsg = { sender_type: 'momi', content: `Error: ${errorMessage}`, timestamp: new Date().toISOString(), isError: true };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsSending(false);
        }
    };

    const toggleChat = () => {
        if (mode === 'floating') {
            setIsOpen(!isOpen);
        }
    };

    if (isInitializing) {
        return (
            <div className="chat-widget-container fullpage-mode">
                <div className="chat-window">
                    <div className="message-list">
                        <div className="initialization-message">Initializing session... If this persists, please refresh.</div>
                    </div>
                </div>
            </div>
        );
    }

    // Add a class to the container based on the mode and open state
    const containerClasses = `chat-widget-container ${
        mode === 'floating' ? (isOpen ? 'open' : 'closed') : ''
    }`;

    // The full-page view has a different root container class
    if (mode === 'fullpage') {
        return (
            <div className="chat-widget-container fullpage-mode">
                 <ChatWindow
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    isSending={isSending}
                    error={error}
                    onClose={() => {}} // No close button in fullpage
                    isWindowOpen={true}
                    mode={mode}
                />
            </div>
        )
    }

    return (
        <div className={containerClasses}>
            {/* The floating button is only rendered in floating mode */}
            <button className={`chat-toggle-button ${isOpen ? 'open' : ''}`} onClick={toggleChat}>
                {isOpen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                )}
            </button>

            {/* The chat window wrapper appears when open */}
            <div className={`chat-window-wrapper ${isOpen ? 'open' : ''}`}>
                 <ChatWindow
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    isSending={isSending}
                    error={error}
                    onClose={toggleChat}
                    isWindowOpen={isOpen}
                    mode={mode}
                />
            </div>
        </div>
    );
}

export default App;
