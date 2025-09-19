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
      const response = await apiClient.get('/admin/users/profiles');
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
    const user = users.find(u => u.auth_user_id === userId);
    if (!confirm(`Are you sure you want to permanently delete ${user?.email} and ALL their data?\n\nThis will delete:\n- User profile\n- All conversations\n- All messages\n- Auth account\n\nThis action cannot be undone.`)) return;
    
    try {
      await apiClient.delete(`/admin/users/${userId}`);
      setUsers(users.filter(u => u.auth_user_id !== userId));
      setSelectedUser(null);
      alert('User deleted successfully.');
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
                    <td>{`${user.first_name || ''} ${user.last_name || ''}`.trim() || 'N/A'}</td>
                    <td>User</td>
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
                <h3>👤 Basic Information</h3>
                <p><strong>Email:</strong> {selectedUser.email}</p>
                <p><strong>Name:</strong> {selectedUser.first_name} {selectedUser.last_name}</p>
                <p><strong>Joined:</strong> {new Date(selectedUser.created_at).toLocaleDateString()}</p>
                {selectedUser.last_sign_in_at && (
                  <p><strong>Last Login:</strong> {new Date(selectedUser.last_sign_in_at).toLocaleString()}</p>
                )}
                <p><strong>Personalized Support:</strong> {selectedUser.personalized_support ? 'Yes' : 'No'}</p>
              </div>
              
              <div className="profile-section">
                <h3>👨‍👩‍👧‍👦 Family Information</h3>
                <p><strong>Family Roles:</strong> {selectedUser.family_roles?.length > 0 ? 
                  selectedUser.family_roles.map(role => {
                    switch(role) {
                      case 'hoping_to_become_mother': return 'Hoping to become a mother';
                      case 'currently_pregnant': return 'Currently pregnant';
                      case 'mom_young_children': return 'Mom of young children (0-5)';
                      case 'mom_school_age': return 'Mom of school-age children (6-12)';
                      case 'mom_teens': return 'Mom of teens (13-18)';
                      case 'wise_woman': return 'Wise woman helping raise children';
                      default: return role;
                    }
                  }).join(', ') : 'Not specified'}</p>
                <p><strong>Children Count:</strong> {selectedUser.children_count || 0}</p>
                <p><strong>Children Ages:</strong> {selectedUser.children_ages?.length > 0 ? 
                  selectedUser.children_ages.map(age => {
                    switch(age) {
                      case '0-2': return '0-2 years (Infant/Toddler)';
                      case '3-5': return '3-5 years (Preschool)';
                      case '6-12': return '6-12 years (School-age)';
                      case '13-18': return '13-18 years (Teen)';
                      case '18+': return '18+ years (Young Adult)';
                      case 'expecting': return 'Expecting a child';
                      default: return age;
                    }
                  }).join(', ') : 'Not specified'}</p>
              </div>
              
              <div className="profile-section">
                <h3>🎯 Wellness Goals</h3>
                <p><strong>Main Concerns:</strong> {selectedUser.main_concerns?.length > 0 ? 
                  selectedUser.main_concerns.map(concern => {
                    switch(concern) {
                      case 'food': return 'Food: Nourishment and healing';
                      case 'resilience': return 'Resilience: Stress, sleep, nervous system support';
                      case 'movement': return 'Movement: Physical activity and energy';
                      case 'community': return 'Community: Relationships and support';
                      case 'spiritual': return 'Spiritual: Purpose and emotional healing';
                      case 'environment': return 'Environment: Detoxifying home';
                      case 'abundance': return 'Abundance: Financial health and resources';
                      default: return concern;
                    }
                  }).join(', ') : 'Not specified'}</p>
                {selectedUser.main_concerns_other && (
                  <p><strong>Other Concerns:</strong> {selectedUser.main_concerns_other}</p>
                )}
              </div>
              
              <div className="profile-section">
                <h3>🍎 Dietary Preferences</h3>
                <p><strong>Preferences:</strong> {selectedUser.dietary_preferences?.length > 0 ? 
                  selectedUser.dietary_preferences.map(pref => {
                    switch(pref) {
                      case 'gluten_free': return 'Gluten-free';
                      case 'dairy_free': return 'Dairy-free';
                      case 'nut_free': return 'Nut-free';
                      case 'soy_free': return 'Soy-free';
                      case 'vegetarian': return 'Vegetarian';
                      case 'vegan': return 'Vegan';
                      case 'no_preference': return 'No specific dietary preferences';
                      default: return pref;
                    }
                  }).join(', ') : 'Not specified'}</p>
                {selectedUser.dietary_preferences_other && (
                  <p><strong>Other Preferences:</strong> {selectedUser.dietary_preferences_other}</p>
                )}
              </div>

              <div className="profile-section danger-zone">
                <h3>⚠️ Danger Zone</h3>
                <p>Permanently delete this user and all their data. This action cannot be undone.</p>
                <button 
                  className="btn-danger-delete"
                  onClick={() => deleteUser(selectedUser.auth_user_id)}
                >
                  🗑️ Delete User Permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegisteredUsers;
