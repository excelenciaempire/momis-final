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

const MessageList = ({ messages, isLoading }) => {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (isLoading) {
    return <div className="message-list-loading">Loading messages...</div>;
  }

  if (!messages || messages.length === 0) {
    return <div className="message-list-empty">No messages yet. Start the conversation!</div>;
  }

  return (
    <div className="message-list">
      {messages.map((msg, index) => (
        <div key={msg.id || index} className={`message-item message-item-${msg.sender_type?.toLowerCase()}`}>
          <div className="message-bubble">
            {msg.content_type === 'image_url' || (msg.metadata?.imageUrl && msg.content_type === 'text') ? (
              <div className="message-image-container">
                <img src={msg.metadata?.imageUrl || msg.content} alt={msg.content === 'Uploading image...' ? msg.content : 'User upload'} className="message-image" />
                {msg.content !== 'Uploading image...' && msg.content_type === 'text' && <p>{msg.content}</p>}
              </div>
            ) : (
              <p>{linkify(msg.content)}</p>
            )}
          </div>
          <span className="message-timestamp">
            {new Date(msg.timestamp).toLocaleTimeString()} - {msg.sender_type?.toUpperCase()}
          </span>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList; 