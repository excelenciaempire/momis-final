import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { supabase } from '../supabaseClient';
import './UserManagementPage.css'; // We'll create this CSS file next

const UserManagementPage = () => {
  const [activeTab, setActiveTab] = useState('registered'); // 'registered' or 'guests'
  const [users, setUsers] = useState([]);
  const [guests, setGuests] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null); // Can be registered user or guest object
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const getToken = async () => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) throw new Error('Not authenticated');
    return session.access_token;
  };

  const fetchRegisteredUsers = useCallback(async () => {
    setIsLoading(true); setError('');
    try {
      const token = await getToken();
      const response = await axios.get('/api/admin/users/registered', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load registered users.');
    }
    setIsLoading(false);
  }, []);

  const fetchGuestUsers = useCallback(async () => {
    setIsLoading(true); setError('');
    try {
      const token = await getToken();
      const response = await axios.get('/api/admin/users/guests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGuests(response.data || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load guest users.');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'registered') {
      fetchRegisteredUsers();
    } else if (activeTab === 'guests') {
      fetchGuestUsers();
    }
    // Reset selections when tab changes
    setSelectedUser(null);
    setConversations([]);
    setSelectedConversation(null);
    setMessages([]);
  }, [activeTab, fetchRegisteredUsers, fetchGuestUsers]);

  const handleUserSelect = async (user, type) => {
    setSelectedUser({ ...user, type }); // type is 'registered' or 'guest'
    setSelectedConversation(null);
    setMessages([]);
    setIsLoading(true); setError('');
    let conversationUrl = '';
    if (type === 'registered') {
        conversationUrl = `/api/admin/users/${user.id}/conversations`;
    } else if (type === 'guest') {
        conversationUrl = `/api/admin/guests/${user.id}/conversations`;
    }

    try {
        const token = await getToken();
        const response = await axios.get(conversationUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });
        setConversations(response.data || []);
    } catch (err) {
        setError(err.response?.data?.error || err.message || 'Failed to load conversations.');
        setConversations([]);
    }
    setIsLoading(false);
  };

  const handleConversationSelect = async (conversation) => {
    setSelectedConversation(conversation);
    setIsLoading(true); setError('');
    try {
        const token = await getToken();
        const response = await axios.get(`/api/admin/conversations/${conversation.id}/messages`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        setMessages(response.data || []);
    } catch (err) {
        setError(err.response?.data?.error || err.message || 'Failed to load messages.');
        setMessages([]);
    }
    setIsLoading(false);
  };

  return (
    <div className="user-management-page">
      <h2>User and Conversation Management</h2>

      <div className="tabs">
        <button 
          className={`tab-button ${activeTab === 'registered' ? 'active' : ''}`}
          onClick={() => setActiveTab('registered')}
        >
          Registered Users
        </button>
        <button 
          className={`tab-button ${activeTab === 'guests' ? 'active' : ''}`}
          onClick={() => setActiveTab('guests')}
        >
          Guest Users
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}

      <div className="content-area">
        <div className="list-panel users-list">
          <h3>{activeTab === 'registered' ? 'Registered Users' : 'Guest Users'}</h3>
          {isLoading && !selectedUser && <p>Loading users...</p>}
          {(activeTab === 'registered' && users.length === 0 && !isLoading) && <p>No registered users found.</p>}
          {(activeTab === 'guests' && guests.length === 0 && !isLoading) && <p>No guest users found.</p>}
          <ul>
            {activeTab === 'registered' && users.map(user => (
              <li key={user.id} onClick={() => handleUserSelect(user, 'registered')} className={selectedUser?.id === user.id && selectedUser?.type === 'registered' ? 'selected' : ''}>
                {user.email || `User ID: ${user.id.substring(0,8)}...`} (Registered: {new Date(user.created_at).toLocaleDateString()})
              </li>
            ))}
            {activeTab === 'guests' && guests.map(guest => (
              <li key={guest.id} onClick={() => handleUserSelect(guest, 'guest')} className={selectedUser?.id === guest.id && selectedUser?.type === 'guest' ? 'selected' : ''}>
                Guest ID: {guest.id.substring(0,8)}... (Created: {new Date(guest.created_at).toLocaleDateString()})
              </li>
            ))}
          </ul>
        </div>

        {selectedUser && (
          <div className="list-panel conversations-list">
            <h3>Conversations for {selectedUser.type === 'registered' ? (selectedUser.email || selectedUser.id.substring(0,8)) : `Guest ${selectedUser.id.substring(0,8)}...`}</h3>
            {isLoading && conversations.length === 0 && !selectedConversation && <p>Loading conversations...</p>}
            {!isLoading && conversations.length === 0 && <p>No conversations found for this user.</p>}
            <ul>
              {conversations.map(conv => (
                <li key={conv.id} onClick={() => handleConversationSelect(conv)} className={selectedConversation?.id === conv.id ? 'selected' : ''}>
                  Conv. ID: {conv.id.substring(0,8)}... (Created: {new Date(conv.created_at).toLocaleString()})
                  {conv.summary && <p className="summary-preview">Summary: {conv.summary.substring(0,50)}...</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {selectedConversation && (
          <div className="messages-panel">
            <h3>Messages for Conversation ID: {selectedConversation.id.substring(0,8)}...</h3>
            {isLoading && messages.length === 0 && <p>Loading messages...</p>}
            {!isLoading && messages.length === 0 && <p>No messages found in this conversation.</p>}
            <div className="messages-container">
              {messages.map(msg => (
                <div key={msg.id} className={`message-bubble message-${msg.sender_type}`}>
                  <p><strong>{msg.sender_type === 'momi' ? 'MOMi' : (msg.sender_type === 'system' ? 'System' : 'User')}:</strong></p>
                  {msg.content_type === 'image_url' ? 
                    <><img src={msg.content} alt="User upload" style={{maxWidth: '200px', borderRadius: '5px'}} /><p>{msg.metadata?.original_user_prompt || '[Image]'}</p></> : 
                    <p>{msg.content}</p>
                  }
                  <span className="message-timestamp">{new Date(msg.timestamp).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagementPage; 