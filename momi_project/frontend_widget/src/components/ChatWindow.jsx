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

const ChatWindow = ({ messages, onSendMessage, isSending, error, onClose, isWindowOpen, mode }) => {
  // This component is now simpler, just for displaying the chat.
  // All logic is handled in App.jsx

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
        {mode !== 'fullpage' && (
            <button onClick={onClose} className="chat-window-close-button" aria-label="Close chat">
                <CloseIcon />
            </button>
        )}
      </div>
      {error && <p className="chat-error-message">{error}</p>}
      <MessageList messages={messages} isLoading={isSending && messages.length === 0} />
      <MessageInput onSendMessage={onSendMessage} isLoading={isSending} messages={messages} />
      <div className="chat-disclaimer">
        <p>MOMi is an AI Chatbot. Information provided is not a substitute for professional medical advice. Always consult with a qualified healthcare provider for any health concerns.</p>
      </div>
    </div>
  );
};

export default ChatWindow;