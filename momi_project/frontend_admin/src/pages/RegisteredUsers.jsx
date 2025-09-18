import React, { useState, useEffect } from 'react';
import apiClient from '../apiClient';
import './RegisteredUsers.css';

const RegisteredUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiClient.get('/admin/users/registered');
      setUsers(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch registered users.');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.profile_data?.first_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.profile_data?.last_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const deleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user and all their data?')) return;
    
    try {
      await apiClient.delete(`/admin/users/${userId}`);
      setUsers(users.filter(u => u.auth_user_id !== userId));
      setSelectedUser(null);
    } catch (err) {
      alert('Failed to delete user: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div>
      <h1 className="page-header">Registered Users Management</h1>
      
      <div className="controls">
        <input
          type="text"
          placeholder="Search users by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <span className="user-count">{filteredUsers.length} users found</span>
      </div>

      <div className="card">
        {loading && <p>Loading users...</p>}
        {error && <div className="error-message">{error}</div>}
        {!loading && !error && (
          <table className="users-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Joined On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.auth_user_id || user.id}>
                    <td>{user.email}</td>
                    <td>{`${user.profile_data?.first_name || ''} ${user.profile_data?.last_name || ''}`.trim() || 'N/A'}</td>
                    <td>{user.role || 'user'}</td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                      <button 
                        className="btn-view" 
                        onClick={() => setSelectedUser(user)}
                      >
                        View Profile
                      </button>
                      <button 
                        className="btn-delete" 
                        onClick={() => deleteUser(user.auth_user_id || user.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5">No users found matching your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* User Profile Modal */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>User Profile Details</h2>
              <button className="modal-close" onClick={() => setSelectedUser(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="profile-section">
                <h3>Basic Information</h3>
                <p><strong>Email:</strong> {selectedUser.email}</p>
                <p><strong>Name:</strong> {selectedUser.profile_data?.first_name} {selectedUser.profile_data?.last_name}</p>
                <p><strong>Role:</strong> {selectedUser.role || 'user'}</p>
                <p><strong>Joined:</strong> {new Date(selectedUser.created_at).toLocaleDateString()}</p>
              </div>
              
              {selectedUser.profile_data && (
                <>
                  <div className="profile-section">
                    <h3>Family Information</h3>
                    <p><strong>Family Roles:</strong> {selectedUser.profile_data.family_roles?.join(', ') || 'N/A'}</p>
                    <p><strong>Children Count:</strong> {selectedUser.profile_data.children_count || 0}</p>
                    <p><strong>Children Ages:</strong> {selectedUser.profile_data.children_ages?.join(', ') || 'N/A'}</p>
                  </div>
                  
                  <div className="profile-section">
                    <h3>Wellness Goals</h3>
                    <p><strong>Main Concerns:</strong> {selectedUser.profile_data.main_concerns?.join(', ') || 'N/A'}</p>
                    {selectedUser.profile_data.main_concerns_other && (
                      <p><strong>Other Concerns:</strong> {selectedUser.profile_data.main_concerns_other}</p>
                    )}
                  </div>
                  
                  <div className="profile-section">
                    <h3>Dietary Preferences</h3>
                    <p><strong>Preferences:</strong> {selectedUser.profile_data.dietary_preferences?.join(', ') || 'N/A'}</p>
                    {selectedUser.profile_data.dietary_preferences_other && (
                      <p><strong>Other Preferences:</strong> {selectedUser.profile_data.dietary_preferences_other}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegisteredUsers;
