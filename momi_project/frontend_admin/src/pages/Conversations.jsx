import React, { useState, useEffect } from 'react';
import apiClient from '../apiClient';
import './Conversations.css';

const Conversations = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiClient.get('/admin/conversations');
      setConversations(response.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setError(err.response?.data?.error || 'Failed to fetch conversations.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      setMessagesLoading(true);
      const response = await apiClient.get(`/admin/conversations/${conversationId}/messages`);
      setMessages(response.data);
    } catch (err) {
      alert('Failed to load messages: ' + (err.response?.data?.error || err.message));
    } finally {
      setMessagesLoading(false);
    }
  };

  const deleteConversation = async (conversationId) => {
    if (!confirm('Are you sure you want to delete this conversation and all its messages?')) return;
    
    try {
      await apiClient.delete(`/admin/conversations/${conversationId}`);
      setConversations(conversations.filter(c => c.id !== conversationId));
      setSelectedConversation(null);
      setMessages([]);
    } catch (err) {
      alert('Failed to delete conversation: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div>
      <h1 className="page-header">Conversations Management</h1>
      
      {loading && <p>Loading conversations...</p>}
      {error && <div className="error-message">{error}</div>}
      
      <div className="conversations-container">
        <div className="conversations-list">
          <div className="conversations-header">
            <h3>All Conversations</h3>
            <button 
              onClick={fetchConversations} 
              disabled={loading}
              className="btn-refresh"
              title="Refresh conversations"
            >
              {loading ? '🔄' : '↻'} Refresh
            </button>
          </div>
          {lastUpdated && (
            <p className="last-updated">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
          {conversations.length === 0 && !loading && (
            <p className="no-data">No conversations found. Users haven't started chatting yet.</p>
          )}
          {conversations.map((conv) => (
            <div 
              key={conv.id} 
              className={`conversation-item ${selectedConversation?.id === conv.id ? 'selected' : ''}`}
              onClick={() => {
                setSelectedConversation(conv);
                fetchMessages(conv.id);
              }}
            >
              <div className="conv-header">
                <span className="conv-user">{conv.user_name || conv.user_email || 'Unknown User'}</span>
                <span className="conv-date">{new Date(conv.created_at).toLocaleDateString()}</span>
              </div>
              <div className="conv-meta">
                <span className="conv-email">{conv.user_email}</span>
                <span className="conv-messages">{conv.message_count || 0} messages</span>
              </div>
              <div className="conv-preview">{conv.last_message_preview || 'No messages yet'}</div>
            </div>
          ))}
        </div>

        {selectedConversation && (
          <div className="messages-panel">
            <div className="messages-header">
              <h3>Messages</h3>
              <button 
                className="btn-delete" 
                onClick={() => deleteConversation(selectedConversation.id)}
              >
                Delete Conversation
              </button>
            </div>
            
            {messagesLoading && <p>Loading messages...</p>}
            
            <div className="messages-list">
              {messages.map((msg) => (
                <div key={msg.id} className={`message ${msg.sender_type}`}>
                  <div className="message-header">
                    <span className="sender">{msg.sender_type === 'user' ? 'User' : 'MOMi'}</span>
                    <span className="timestamp">{new Date(msg.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="message-content">{msg.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Conversations;
