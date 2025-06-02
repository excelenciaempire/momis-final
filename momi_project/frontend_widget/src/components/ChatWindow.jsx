import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import './ChatWindow.css';

// Simple SVG icon for Close button (can be replaced with a proper icon library later)
const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

// Simple M logo for the header
const MomiLogo = () => (
  <div className="chat-window-header-logo">
    <span>M</span>
  </div>
);

const ChatWindow = ({ userId, guestUserId, sessionToken, toggleChatOpen, onGuestSessionUpdate }) => {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const currentUserId = userId || guestUserId;
  const userType = userId ? 'user' : 'guest';

  // Set initial message from MOMi
  useEffect(() => {
    setMessages([
      {
        id: 'momi-initial-greeting',
        sender_type: 'momi',
        content_type: 'text',
        content: "Hi, I'm MOMi – your personal wellness guide and parenting support coach. I'm here to help you feel more confident and connected in your journey to raise a healthy family.\n\nWhat would you like support with today?\n\n• A quick tip for meals, sleep, or stress\n• Help calming a tough moment with your child\n• Ideas to feel more balanced or energized\n\nJust type what's on your mind. I'm here 💜",
        timestamp: new Date().toISOString(),
      }
    ]);
  }, []); // Run only once on component mount

  // Fetch history when conversationId changes or component mounts with a valid user ID
  useEffect(() => {
    const fetchHistory = async (convId) => {
      if (!convId) return;
      setIsLoading(true);
      try {
        const response = await axios.get(`/api/chat/history/${convId}`);
        // Prepend history to the initial greeting, or replace if history is substantial
        if (response.data && response.data.length > 0) {
          setMessages(prevMessages => {
            const initialMessage = prevMessages.find(m => m.id === 'momi-initial-greeting');
            const history = response.data.filter(m => m.id !== 'momi-initial-greeting'); // Avoid duplicates if any
            if (initialMessage && history.length === 0) { // Only initial message was present
                return [initialMessage, ...history]; // Should not happen if history is fetched based on convId
            }
            return history; // If history exists, it should replace the initial greeting
          });
        }
        setError('');
      } catch (err) {
        console.error('Error fetching chat history:', err);
        setError('Failed to load chat history.');
        setMessages([]); // Clear messages on error
      }
      setIsLoading(false);
    };

    // If there's a conversationId, fetch its history
    if (conversationId) {
        fetchHistory(conversationId);
    } else {
      // No conversation ID yet, ensure initial message is set (if not already by the first useEffect)
      // This handles cases where currentUserId might be available but no conversationId yet.
      if (messages.length === 0 || (messages.length === 1 && messages[0].id !== 'momi-initial-greeting')) {
         setMessages([
          {
            id: 'momi-initial-greeting',
            sender_type: 'momi',
            content_type: 'text',
            content: "Hi, I'm MOMi – your personal wellness guide and parenting support coach. I'm here to help you feel more confident and connected in your journey to raise a healthy family.\n\nWhat would you like support with today?\n\n• A quick tip for meals, sleep, or stress\n• Help calming a tough moment with your child\n• Ideas to feel more balanced or energized\n\nJust type what's on your mind. I'm here 💜",
            timestamp: new Date().toISOString(),
          }
        ]);
      }
    }
    // TODO: Consider fetching existing conversation ID for the user/guest if not passed

  }, [conversationId, currentUserId]); // Rerun if conversationId or user changes

  const handleSendMessage = async (text, imageFile = null) => {
    if ((!text || text.trim() === '') && !imageFile) return;

    setIsLoading(true);
    setError('');

    // Optimistic UI update for text message
    const optimisticTextMessageId = Date.now();
    if (text.trim()) {
        const userTextMessage = {
            sender_type: 'user',
            content_type: 'text',
            content: text,
            timestamp: new Date().toISOString(),
            id: optimisticTextMessageId 
        };
        setMessages(prevMessages => [...prevMessages, userTextMessage]);
    }
    
    let uploadedImageUrl = null;
    let optimisticImageMessageId = null;

    if (imageFile) {
      optimisticImageMessageId = Date.now() + 1; // Ensure different ID
      // Optimistic UI update for image uploading
      const userImageMessage = {
        sender_type: 'user',
        content_type: 'image_url', // Temporarily, will be confirmed by backend
        content: 'Uploading image...', // Placeholder content
        metadata: { localPreview: URL.createObjectURL(imageFile) }, // For local display
        timestamp: new Date().toISOString(),
        id: optimisticImageMessageId
      };
      setMessages(prevMessages => [...prevMessages, userImageMessage]);

      const formData = new FormData();
      formData.append('image', imageFile);

      try {
        const uploadResponse = await axios.post('/api/chat/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        uploadedImageUrl = uploadResponse.data.imageUrl;
        // Update optimistic image message with actual URL or remove if text was also sent
        setMessages(prev => prev.map(msg => 
            msg.id === optimisticImageMessageId ? {...msg, content: uploadedImageUrl, metadata: { ...msg.metadata, serverUrl: uploadedImageUrl} } : msg
        ));

      } catch (uploadError) {
        console.error('Error uploading image:', uploadError);
        setError(`Image Upload Failed: ${uploadError.response?.data?.details || uploadError.message}`);
        setMessages(prev => prev.map(msg => 
            msg.id === optimisticImageMessageId ? {...msg, content: 'Upload Failed', error: true } : msg
        ));
        setIsLoading(false);
        return;
      }
    }

    try {
      // If only image was sent and no text, use a default prompt or image URL as message
      const messageToSend = text.trim() || (uploadedImageUrl ? "Image attached" : "");
      if (!messageToSend && !uploadedImageUrl) {
        // This case should be rare due to initial check, but as a safeguard
        setIsLoading(false);
        if (text.trim() && optimisticTextMessageId) { // if text was there but failed before this point
             setMessages(prev => prev.filter(msg => msg.id !== optimisticTextMessageId));
        }
        return;
      }

      const payload = {
        message: messageToSend,
        conversationId: conversationId,
        ...(userId ? { userId } : { guestUserId }),
        ...(uploadedImageUrl && { imageUrl: uploadedImageUrl })
      };
      
      const response = await axios.post('/api/chat/message', payload);
      
      const momiReply = {
        sender_type: 'momi',
        content_type: 'text',
        content: response.data.reply,
        timestamp: new Date().toISOString(),
        id: Date.now() + 2 // Ensure different ID
      };

      if (response.data.conversationId && !conversationId) {
        setConversationId(response.data.conversationId);
      }

      // Check if a new guest session was created and update it
      if (response.data.newGuestSession) {
        if (onGuestSessionUpdate) {
            onGuestSessionUpdate(response.data.newGuestSession);
        } else {
            console.warn('ChatWindow: newGuestSession received but onGuestSessionUpdate prop is missing.');
        }
      }
      
      // Remove optimistic text message if it was successfully processed as part of the image message or separately
      if (text.trim() && optimisticTextMessageId && (!uploadedImageUrl || (uploadedImageUrl && messageToSend !== "Image attached"))){
         // if text was primary and image was secondary, or no image, the text message is distinct and handled by backend
      } else if (text.trim() && optimisticTextMessageId && uploadedImageUrl && messageToSend === "Image attached") {
         // If text was just "Image attached" because original text was empty, remove the optimistic text message
         setMessages(prev => prev.filter(msg => msg.id !== optimisticTextMessageId));
      }

      setMessages(prevMessages => [...prevMessages, momiReply]);
      setError('');

    } catch (err) {
      console.error('Error sending message:', err);
      const errorText = `MOMi Error: ${err.response?.data?.details || err.message || 'Could not send message.'}`;
      setError(errorText);
       const errorReply = {
        sender_type: 'system',
        content_type: 'text',
        content: errorText,
        timestamp: new Date().toISOString(),
        id: Date.now() + 3 
      };
      setMessages(prev => [...prev, errorReply]);
    }
    setIsLoading(false);
  };

  if (!currentUserId && !sessionToken) {
    // This check is a bit redundant if App.jsx handles guest session creation robustly
    // but good as a safeguard within ChatWindow itself.
    return (
        <div className="chat-window-container">
            <div className="chat-window-header">
                <h2 className="chat-window-title">MOMi Support</h2>
            </div>
            <p className="chat-loading-error">Initializing session... If this persists, please refresh.</p>
        </div>
    );
  }

  return (
    <div className="chat-window-main-content">
      <div className="chat-window-header">
        <div className="header-content-left">
          <MomiLogo />
          <div className="header-titles">
            <h2 className="chat-window-title">MOMi</h2>
            <p className="chat-window-subtitle">Your Wellness Assistant</p>
          </div>
        </div>
        <button onClick={toggleChatOpen} className="chat-window-close-button" aria-label="Close chat">
          <CloseIcon />
        </button>
      </div>
      {error && <p className="chat-error-message">{error}</p>}
      <MessageList messages={messages} isLoading={isLoading && messages.length === 0} />
      <MessageInput onSendMessage={handleSendMessage} isLoading={isLoading} />
      <div className="chat-disclaimer">
        <p>MOMi is an AI Chatbot. Information provided is not a substitute for professional medical advice. Always consult with a qualified healthcare provider for any health concerns.</p>
      </div>
    </div>
  );
};

export default ChatWindow; 