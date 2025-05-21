import React, { useEffect, useRef } from 'react';
import './MessageList.css';

// Function to detect URLs and replace them with anchor tags
const linkify = (text) => {
  const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  return text.split(urlRegex).map((part, index) => {
    if (urlRegex.test(part)) {
      const href = part.startsWith('www.') ? `http://${part}` : part;
      return <a key={index} href={href} target="_blank" rel="noopener noreferrer">{part}</a>;
    }
    return part;
  });
};

// Simple M avatar for MOMi messages
const MomiAvatar = () => (
  <div className="momi-avatar">
    <span>M</span>
  </div>
);

const MessageList = ({ messages, isLoading }) => {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Define the initial greeting message from MOMi
  const initialGreetingMessage = {
    id: 'initial-greeting',
    sender_type: 'momi',
    content_type: 'text',
    content: "Hi there! I'm MOMi, your wellness assistant. I'm here to support you with advice based on the 7 Pillars of Wellness. How can I help you today?",
    timestamp: new Date().toISOString() // Or a fixed earlier timestamp
  };

  // Combine initial greeting with other messages if no messages exist yet
  const displayMessages = messages.length === 0 && !isLoading ? [initialGreetingMessage] : messages;

  if (isLoading && displayMessages.length === 0) {
    return <div className="message-list-loading">Loading messages...</div>;
  }

  return (
    <div className="message-list">
      {displayMessages.map((msg, index) => (
        <div
          key={msg.id || index} // Use msg.id if available, fallback to index
          className={`message-item ${msg.sender_type} ${msg.content_type} ${msg.id === 'initial-greeting' ? 'initial-greeting' : ''}`}
        >
          {msg.sender_type === 'momi' && (
            <MomiAvatar />
          )}
          <div className="message-content">
            {msg.content_type === 'image_url' ? (
              msg.error ? (
                <span className="upload-error-text">{msg.content}</span>
              ) : msg.metadata?.localPreview ? (
                <img src={msg.metadata.localPreview} alt="Uploaded preview" className="message-image" />
              ) : (
                <img src={msg.content} alt="Uploaded image" className="message-image" />
              )
            ) : (
              <p>{msg.content}</p>
            )}
          </div>
          {/* <span className="message-timestamp">
            {msg.id !== 'initial-greeting' && `${new Date(msg.timestamp).toLocaleTimeString()} - ${msg.sender_type?.toUpperCase()}`}
          </span> */}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList; 