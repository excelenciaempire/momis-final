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

// Hamburger menu icon
const HamburgerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
);

const ChatWindow = ({ messages, onSendMessage, isSending, error, onClose, isWindowOpen, mode, userId, onNewConversation, onLoadConversation }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(false);

  // Fetch user conversations
  const fetchConversations = async () => {
    if (!userId) return;
    
    try {
      setLoadingConversations(true);
      const response = await axios.get(`/api/chat/conversations/${userId}`);
      setConversations(response.data);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  };

  useEffect(() => {
    if (isMenuOpen && userId) {
      fetchConversations();
    }
  }, [isMenuOpen, userId]);

  const handleNewConversation = () => {
    setIsMenuOpen(false);
    if (onNewConversation) onNewConversation();
  };

  const handleLoadConversation = (conversationId) => {
    setIsMenuOpen(false);
    if (onLoadConversation) onLoadConversation(conversationId);
  };

  return (
    <div className={`chat-window-main-content ${mode === 'fullpage' ? 'fullpage-mode' : ''}`}>
      <div className="chat-window-header">
        <div className="header-content-left">
          <MomiLogo />
          <div className="header-titles">
            <h2 className="chat-window-title">MOMi</h2>
            <p className="chat-window-subtitle">Your Wellness Assistant</p>
          </div>
        </div>
        <div className="header-content-right">
          {userId && (
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)} 
              className="hamburger-button" 
              aria-label="Open conversations menu"
            >
              <HamburgerIcon />
            </button>
          )}
          {mode !== 'fullpage' && (
            <button onClick={onClose} className="chat-window-close-button" aria-label="Close chat">
              <CloseIcon />
            </button>
          )}
        </div>
      </div>
      {error && <p className="chat-error-message">{error}</p>}
      <MessageList messages={messages} isLoading={isSending && messages.length === 0} />
      <MessageInput onSendMessage={onSendMessage} isLoading={isSending} messages={messages} />
      <div className="chat-disclaimer">
        <p>MOMi is an AI Chatbot. Information provided is not a substitute for professional medical advice. Always consult with a qualified healthcare provider for any health concerns.</p>
      </div>

      {/* Conversations Menu Overlay */}
      {isMenuOpen && (
        <div className="menu-overlay" onClick={() => setIsMenuOpen(false)}>
          <div className="conversations-menu" onClick={(e) => e.stopPropagation()}>
            <div className="menu-header">
              <h3>💬 Your Conversations</h3>
              <button className="menu-close" onClick={() => setIsMenuOpen(false)}>×</button>
            </div>
            
            <div className="menu-actions">
              <button className="new-chat-btn" onClick={handleNewConversation}>
                ➕ Start New Chat
              </button>
            </div>

            <div className="conversations-list">
              {loadingConversations && <p>Loading conversations...</p>}
              
              {!loadingConversations && conversations.length === 0 && (
                <p className="no-conversations">No previous conversations found. Start chatting to create your first conversation!</p>
              )}
              
              {conversations.map((conv) => (
                <div 
                  key={conv.id} 
                  className="conversation-item"
                  onClick={() => handleLoadConversation(conv.id)}
                >
                  <div className="conv-preview">
                    <span className="conv-date">
                      {new Date(conv.created_at).toLocaleDateString()}
                    </span>
                    <span className="conv-time">
                      {new Date(conv.last_message_at || conv.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <div className="conv-snippet">
                    Chat from {new Date(conv.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;