import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { supabase } from '../supabaseClient';
import './RegisteredUsersPage.css';

const RegisteredUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState({ type: '', message: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [dashboardStats, setDashboardStats] = useState(null);

  const getToken = async () => {
    const sessionData = await supabase.auth.getSession();
    const session = sessionData?.data?.session;
    if (session) {
      return session.access_token;
    }
    console.warn("No active session for admin operations");
    return null;
  };

  const handleError = (err, defaultMessage) => {
    console.error(defaultMessage, err);
    setNotification({ type: 'error', message: err.response?.data?.error || err.message || defaultMessage });
  };

  // Fetch dashboard statistics
  const fetchDashboardStats = useCallback(async () => {
    try {
      const token = await getToken();
      const response = await axios.get('/api/admin/dashboard/stats', {
        headers: token ? { 'X-Admin-Session': token } : {},
      });
      setDashboardStats(response.data);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    }
  }, []);

  // Fetch all registered users
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setNotification({ type: '', message: '' });
    try {
      const token = await getToken();
      const response = await axios.get('/api/admin/users/registered', {
        headers: token ? { 'X-Admin-Session': token } : {},
      });
      setUsers(response.data || []);
    } catch (err) {
      handleError(err, 'Failed to load registered users.');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboardStats();
    fetchUsers();
  }, [fetchDashboardStats, fetchUsers]);

  const handleUserSelect = async (user) => {
    setSelectedUser(user);
    setSelectedConversation(null);
    setMessages([]);
    setIsLoading(true);
    setNotification({ type: '', message: '' });

    try {
      const token = await getToken();
      const response = await axios.get(`/api/admin/users/${user.auth_user_id}/conversations`, {
        headers: token ? { 'X-Admin-Session': token } : {},
      });
      setConversations(response.data || []);
    } catch (err) {
      handleError(err, 'Failed to load conversations.');
      setConversations([]);
    }
    setIsLoading(false);
  };

  const handleConversationSelect = async (conversation) => {
    setSelectedConversation(conversation);
    setIsLoading(true);
    setNotification({ type: '', message: '' });

    try {
      const token = await getToken();
      const response = await axios.get(`/api/admin/conversations/${conversation.id}/messages`, {
        headers: token ? { 'X-Admin-Session': token } : {},
      });
      setMessages(response.data || []);
    } catch (err) {
      handleError(err, 'Failed to load messages.');
      setMessages([]);
    }
    setIsLoading(false);
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (!window.confirm(`Are you sure you want to delete user ${userEmail} and all their data? This action cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    setNotification({ type: '', message: '' });
    try {
      const token = await getToken();
      await axios.delete(`/api/admin/users/${userId}`, {
        headers: token ? { 'X-Admin-Session': token } : {},
      });
      setNotification({ type: 'success', message: 'User and their data deleted successfully.' });
      fetchUsers(); // Refresh user list
      fetchDashboardStats(); // Refresh stats

      // Clear selections if deleted user was selected
      if (selectedUser && selectedUser.auth_user_id === userId) {
        setSelectedUser(null);
        setConversations([]);
        setSelectedConversation(null);
        setMessages([]);
      }
    } catch (err) {
      handleError(err, 'Failed to delete user.');
    }
    setIsLoading(false);
  };

  const handleDeleteConversation = async (conversationId) => {
    if (!window.confirm(`Are you sure you want to delete this conversation? This action cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    setNotification({ type: '', message: '' });
    try {
      const token = await getToken();
      await axios.delete(`/api/admin/conversations/${conversationId}`, {
        headers: token ? { 'X-Admin-Session': token } : {},
      });
      setNotification({ type: 'success', message: 'Conversation deleted successfully.' });

      // Refresh conversations for the current user
      if (selectedUser) {
        handleUserSelect(selectedUser);
      }
      fetchDashboardStats(); // Refresh stats

      // Clear conversation selection if this one was selected
      if (selectedConversation && selectedConversation.id === conversationId) {
        setSelectedConversation(null);
        setMessages([]);
      }
    } catch (err) {
      handleError(err, 'Failed to delete conversation.');
    }
    setIsLoading(false);
  };

  // Filter and sort users
  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = filterRole === 'all' ||
      (user.family_roles && user.family_roles.includes(filterRole));

    return matchesSearch && matchesRole;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      case 'email':
        return a.email.localeCompare(b.email);
      case 'created_at':
      default:
        return new Date(b.created_at) - new Date(a.created_at);
    }
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatFamilyRoles = (roles) => {
    if (!roles || roles.length === 0) return 'Not specified';
    return roles.map(role => {
      switch(role) {
        case 'hoping_to_become_mother': return 'Hoping to become mother';
        case 'currently_pregnant': return 'Currently pregnant';
        case 'mom_young_children': return 'Mom of young children';
        case 'mom_school_age': return 'Mom of school-age children';
        case 'mom_teens': return 'Mom of teens';
        case 'wise_woman': return 'Wise woman';
        default: return role;
      }
    }).join(', ');
  };

  const formatConcerns = (concerns, other) => {
    if (!concerns || concerns.length === 0) return 'Not specified';
    const formatted = concerns.map(concern => {
      switch(concern) {
        case 'food': return 'Food & Nourishment';
        case 'resilience': return 'Stress & Resilience';
        case 'movement': return 'Movement & Energy';
        case 'community': return 'Community & Support';
        case 'spiritual': return 'Spiritual Wellness';
        case 'environment': return 'Healthy Environment';
        case 'abundance': return 'Financial Wellness';
        default: return concern;
      }
    });
    if (other) formatted.push(`Other: ${other}`);
    return formatted.join(', ');
  };

  const formatDietary = (preferences, other) => {
    if (!preferences || preferences.length === 0) return 'No preferences specified';
    const formatted = preferences.map(pref => {
      switch(pref) {
        case 'gluten_free': return 'Gluten-free';
        case 'dairy_free': return 'Dairy-free';
        case 'nut_free': return 'Nut-free';
        case 'soy_free': return 'Soy-free';
        case 'vegetarian': return 'Vegetarian';
        case 'vegan': return 'Vegan';
        case 'no_preference': return 'No specific preference';
        default: return pref;
      }
    });
    if (other) formatted.push(`Other: ${other}`);
    return formatted.join(', ');
  };

  return (
    <div className="registered-users-page">
      <div className="page-header">
        <h1>Registered Users Management</h1>
        <p>Manage registered users, view their profiles, and monitor conversations.</p>
      </div>

      {/* Dashboard Statistics */}
      {dashboardStats && (
        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-number">{dashboardStats.total_users}</div>
            <div className="stat-label">Total Users</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{dashboardStats.new_users_this_week}</div>
            <div className="stat-label">New This Week</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{dashboardStats.active_users_this_week}</div>
            <div className="stat-label">Active This Week</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{dashboardStats.total_conversations}</div>
            <div className="stat-label">Total Conversations</div>
          </div>
        </div>
      )}

      {notification.message && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Filters and Search */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-controls">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Roles</option>
            <option value="hoping_to_become_mother">Hoping to become mother</option>
            <option value="currently_pregnant">Currently pregnant</option>
            <option value="mom_young_children">Mom of young children</option>
            <option value="mom_school_age">Mom of school-age children</option>
            <option value="mom_teens">Mom of teens</option>
            <option value="wise_woman">Wise woman</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="created_at">Sort by Join Date</option>
            <option value="name">Sort by Name</option>
            <option value="email">Sort by Email</option>
          </select>
        </div>
      </div>

      <div className="content-grid">
        {/* Users List */}
        <div className="users-panel">
          <div className="panel-header">
            <h3>Registered Users ({filteredUsers.length})</h3>
          </div>
          {isLoading && !selectedUser ? (
            <div className="loading">Loading users...</div>
          ) : (
            <div className="users-list">
              {filteredUsers.map(user => (
                <div
                  key={user.auth_user_id}
                  className={`user-item ${selectedUser?.auth_user_id === user.auth_user_id ? 'selected' : ''}`}
                  onClick={() => handleUserSelect(user)}
                >
                  <div className="user-info">
                    <div className="user-name">{user.first_name} {user.last_name}</div>
                    <div className="user-email">{user.email}</div>
                    <div className="user-roles">{formatFamilyRoles(user.family_roles)}</div>
                    <div className="user-date">Joined: {formatDate(user.created_at)}</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteUser(user.auth_user_id, user.email);
                    }}
                    className="delete-btn"
                    title="Delete User"
                    disabled={isLoading}
                  >
                    🗑️
                  </button>
                </div>
              ))}
              {filteredUsers.length === 0 && !isLoading && (
                <div className="empty-state">No users found matching your criteria.</div>
              )}
            </div>
          )}
        </div>

        {/* User Profile Details */}
        {selectedUser && (
          <div className="user-details-panel">
            <div className="panel-header">
              <h3>{selectedUser.first_name} {selectedUser.last_name}'s Profile</h3>
            </div>
            <div className="user-profile">
              <div className="profile-section">
                <h4>Basic Information</h4>
                <div className="profile-field">
                  <label>Name:</label>
                  <span>{selectedUser.first_name} {selectedUser.last_name}</span>
                </div>
                <div className="profile-field">
                  <label>Email:</label>
                  <span>{selectedUser.email}</span>
                </div>
                <div className="profile-field">
                  <label>Joined:</label>
                  <span>{formatDate(selectedUser.created_at)}</span>
                </div>
              </div>

              <div className="profile-section">
                <h4>Family Information</h4>
                <div className="profile-field">
                  <label>Family Roles:</label>
                  <span>{formatFamilyRoles(selectedUser.family_roles)}</span>
                </div>
                <div className="profile-field">
                  <label>Number of Children:</label>
                  <span>{selectedUser.children_count}</span>
                </div>
                {selectedUser.children_ages && selectedUser.children_ages.length > 0 && (
                  <div className="profile-field">
                    <label>Children Ages:</label>
                    <span>{selectedUser.children_ages.join(', ')}</span>
                  </div>
                )}
              </div>

              <div className="profile-section">
                <h4>Wellness Goals</h4>
                <div className="profile-field">
                  <label>Main Concerns:</label>
                  <span>{formatConcerns(selectedUser.main_concerns, selectedUser.main_concerns_other)}</span>
                </div>
              </div>

              <div className="profile-section">
                <h4>Preferences</h4>
                <div className="profile-field">
                  <label>Dietary Preferences:</label>
                  <span>{formatDietary(selectedUser.dietary_preferences, selectedUser.dietary_preferences_other)}</span>
                </div>
                <div className="profile-field">
                  <label>Personalized Support:</label>
                  <span>{selectedUser.personalized_support ? 'Yes' : 'No'}</span>
                </div>
              </div>

              <div className="profile-section">
                <h4>Conversations</h4>
                {isLoading ? (
                  <div className="loading">Loading conversations...</div>
                ) : (
                  <div className="conversations-list">
                    {conversations.length === 0 ? (
                      <div className="empty-state">No conversations yet.</div>
                    ) : (
                      conversations.map(conv => (
                        <div
                          key={conv.id}
                          className={`conversation-item ${selectedConversation?.id === conv.id ? 'selected' : ''}`}
                          onClick={() => handleConversationSelect(conv)}
                        >
                          <div className="conversation-info">
                            <div className="conversation-id">Conv: {conv.id.substring(0, 8)}...</div>
                            <div className="conversation-date">{formatDate(conv.created_at)}</div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConversation(conv.id);
                            }}
                            className="delete-btn small"
                            title="Delete Conversation"
                            disabled={isLoading}
                          >
                            🗑️
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Messages Panel */}
        {selectedConversation && (
          <div className="messages-panel">
            <div className="panel-header">
              <h3>Conversation Messages</h3>
              <div className="conversation-meta">
                ID: {selectedConversation.id.substring(0, 8)}... • {formatDate(selectedConversation.created_at)}
              </div>
            </div>
            {isLoading ? (
              <div className="loading">Loading messages...</div>
            ) : (
              <div className="messages-list">
                {messages.length === 0 ? (
                  <div className="empty-state">No messages in this conversation.</div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className={`message ${msg.sender_type}`}>
                      <div className="message-header">
                        <span className="sender">
                          {msg.sender_type === 'momi' ? '🤖 MOMi' : '👤 User'}
                        </span>
                        <span className="timestamp">{formatDate(msg.timestamp)}</span>
                      </div>
                      <div className="message-content">
                        {msg.content_type === 'image_url' ? (
                          <div className="image-message">
                            <img src={msg.content} alt="User upload" className="message-image" />
                            {msg.metadata?.original_user_prompt && (
                              <p className="image-prompt">{msg.metadata.original_user_prompt}</p>
                            )}
                          </div>
                        ) : (
                          <p>{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RegisteredUsersPage;