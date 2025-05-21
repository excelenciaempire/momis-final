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
  const [notification, setNotification] = useState({ type: '', message: '' });
  const [messageChannel, setMessageChannel] = useState(null); // For Supabase Realtime subscription

  const getToken = async () => {
    const sessionData = await supabase.auth.getSession();
    const session = sessionData?.data?.session;
    // if (!session) throw new Error('Not authenticated. Please log in.'); // Allow proceeding for preview
    if (session) {
      return session.access_token;
    }
    console.warn("UserManagementPage: No active session, proceeding for preview. API calls may fail if auth is enforced by backend.");
    return null; // Return null if no session, API calls will adapt
  };

  const handleFetchError = (err, defaultMessage) => {
    console.error(defaultMessage, err);
    setNotification({ type: 'error', message: err.response?.data?.error || err.message || defaultMessage });
  };

  const fetchRegisteredUsers = useCallback(async () => {
    setIsLoading(true); setNotification({ type: '', message: '' });
    try {
      const token = await getToken();
      const response = await axios.get('/api/admin/users/registered', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setUsers(response.data || []);
    } catch (err) {
      handleFetchError(err, 'Failed to load registered users.');
    }
    setIsLoading(false);
  }, []);

  const fetchGuestUsers = useCallback(async () => {
    setIsLoading(true); setNotification({ type: '', message: '' });
    try {
      const token = await getToken();
      const response = await axios.get('/api/admin/users/guests', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setGuests(response.data || []);
    } catch (err) {
      handleFetchError(err, 'Failed to load guest users.');
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
    setIsLoading(true); setNotification({ type: '', message: '' });
    let conversationUrl = '';
    if (type === 'registered') {
        conversationUrl = `/api/admin/users/${user.id}/conversations`;
    } else if (type === 'guest') {
        conversationUrl = `/api/admin/guests/${user.id}/conversations`;
    }

    try {
        const token = await getToken();
        const response = await axios.get(conversationUrl, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setConversations(response.data || []);
    } catch (err) {
        handleFetchError(err, 'Failed to load conversations.');
        setConversations([]);
    }
    setIsLoading(false);
  };

  const handleConversationSelect = async (conversation) => {
    setSelectedConversation(conversation);
    setIsLoading(true); setNotification({ type: '', message: '' });
    
    // Clean up any existing channel before creating a new one
    if (messageChannel) {
      supabase.removeChannel(messageChannel);
      setMessageChannel(null);
    }

    try {
        const token = await getToken();
        const response = await axios.get(`/api/admin/conversations/${conversation.id}/messages`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setMessages(response.data || []);

        // Setup Supabase Realtime subscription for new messages in this conversation
        const channel = supabase
          .channel(`messages_conv_${conversation.id}`)
          .on(
            'postgres_changes',
            { 
              event: 'INSERT', 
              schema: 'public', 
              table: 'messages', 
              filter: `conversation_id=eq.${conversation.id}` 
            },
            (payload) => {
              setMessages((currentMessages) => {
                // Avoid adding duplicate if message already exists (e.g. from initial load + real-time)
                // This is a simple check; more robust duplicate handling might be needed
                if (currentMessages.find(msg => msg.id === payload.new.id)) {
                  return currentMessages;
                }
                return [...currentMessages, payload.new];
              });
            }
          )
          .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
              console.log(`Subscribed to messages for conversation ${conversation.id}`);
            }
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.error(`Subscription error for conv ${conversation.id}:`, err);
              setNotification({ type: 'error', message: `Real-time connection error for messages: ${err?.message || 'Unknown error'}`});
            }
          });
        setMessageChannel(channel);

    } catch (err) {
        handleFetchError(err, 'Failed to load messages.');
        setMessages([]);
    }
    setIsLoading(false);
  };

  // Effect for cleaning up the Supabase subscription
  useEffect(() => {
    return () => {
      if (messageChannel) {
        console.log("Cleaning up message subscription:", messageChannel.topic);
        supabase.removeChannel(messageChannel);
        // messageChannel.unsubscribe(); // removeChannel should handle this
        setMessageChannel(null);
      }
    };
  }, [messageChannel]); // Run cleanup when messageChannel itself changes or component unmounts

  const renderUserItem = (user, type) => (
    <li key={user.id} onClick={() => handleUserSelect(user, type)} className={`list-item ${selectedUser?.id === user.id && selectedUser?.type === type ? 'selected' : ''}`}>
      {type === 'registered' ? (user.email || `User ID: ${user.id.substring(0,8)}...`) : `Guest ID: ${user.id.substring(0,8)}...`}
      <span className="date-info">(Created: {new Date(user.created_at).toLocaleDateString()})</span>
    </li>
  );

  const renderConversationItem = (conv) => (
    <li key={conv.id} onClick={() => handleConversationSelect(conv)} className={`list-item ${selectedConversation?.id === conv.id ? 'selected' : ''}`}>
      Conv. ID: {conv.id.substring(0,8)}...
      <span className="date-info">(Created: {new Date(conv.created_at).toLocaleString()})</span>
      {/* TODO: Add conversation summary if available from backend */}
      {/* {conv.summary && <p className="summary-preview">{conv.summary.substring(0,50)}...</p>} */}
    </li>
  );

  return (
    <div className="user-management-container">
      <h1 className="page-header">User and Conversation Management</h1>

      <div className="tabs-container mb-2">
        <button 
          className={`button ${activeTab === 'registered' ? 'primary' : 'secondary'}`}
          onClick={() => setActiveTab('registered')}
        >
          Registered Users
        </button>
        <button 
          className={`button ml-1 ${activeTab === 'guests' ? 'primary' : 'secondary'}`}
          onClick={() => setActiveTab('guests')}
        >
          Guest Users
        </button>
      </div>

      {notification.message && (
        <div className={`${notification.type}-message card mb-2`}>{notification.message}</div>
      )}

      <div className="panels-grid">
        <div className="card list-panel">
          <div className="card-header">{activeTab === 'registered' ? 'Registered Users' : 'Guest Users'}</div>
          {(isLoading && !selectedUser && users.length === 0 && guests.length === 0) && <p className="loading-text">Loading users...</p>}
          {(activeTab === 'registered' && users.length === 0 && !isLoading) && <p className="empty-text">No registered users found.</p>}
          {(activeTab === 'guests' && guests.length === 0 && !isLoading) && <p className="empty-text">No guest users found.</p>}
          <ul className="item-list">
            {activeTab === 'registered' && users.map(user => renderUserItem(user, 'registered'))}
            {activeTab === 'guests' && guests.map(guest => renderUserItem(guest, 'guest'))}
          </ul>
        </div>

        {selectedUser && (
          <div className="card list-panel">
            <div className="card-header">Conversations for {selectedUser.type === 'registered' ? (selectedUser.email || selectedUser.id.substring(0,8)) : `Guest ${selectedUser.id.substring(0,8)}...`}</div>
            {(isLoading && conversations.length === 0 && !selectedConversation) && <p className="loading-text">Loading conversations...</p>}
            {!isLoading && conversations.length === 0 && <p className="empty-text">No conversations found.</p>}
            <ul className="item-list">
              {conversations.map(conv => renderConversationItem(conv))}
            </ul>
          </div>
        )}

        {selectedConversation && (
          <div className="card messages-panel">
            <div className="card-header">Messages (Conv. ID: {selectedConversation.id.substring(0,8)}...)</div>
            {(isLoading && messages.length === 0) && <p className="loading-text">Loading messages...</p>}
            {!isLoading && messages.length === 0 && <p className="empty-text">No messages in this conversation.</p>}
            <div className="messages-display-area">
              {messages.map(msg => (
                <div key={msg.id} className={`message-bubble msg-${msg.sender_type.toLowerCase()}`}>
                  <p className="sender-label">
                    <strong>{msg.sender_type === 'momi' ? 'MOMi' : (msg.sender_type === 'system' ? 'System' : 'User')}</strong>
                  </p>
                  {msg.content_type === 'image_url' ? 
                    <div className="image-message-content">
                        <img src={msg.content} alt="User upload" className="message-image" />
                        {msg.metadata?.original_user_prompt && <p className="image-prompt">{msg.metadata.original_user_prompt}</p>}
                    </div> : 
                    <p className="text-content">{msg.content}</p>
                  }
                  <span className="timestamp">{new Date(msg.timestamp).toLocaleString()}</span>
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