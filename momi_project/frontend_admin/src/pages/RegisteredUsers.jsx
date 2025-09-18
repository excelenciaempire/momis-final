import React, { useState, useEffect } from 'react';
import apiClient from '../apiClient';
import './RegisteredUsers.css'; // We will create this

const RegisteredUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
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

    fetchUsers();
  }, []);

  return (
    <div>
      <h1 className="page-header">Registered Users Management</h1>
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
              </tr>
            </thead>
            <tbody>
              {users.length > 0 ? (
                users.map((user) => (
                  <tr key={user.auth_user_id}>
                    <td>{user.email}</td>
                    <td>{`${user.profile_data?.first_name || ''} ${user.profile_data?.last_name || ''}`}</td>
                    <td>{user.profile_data?.role || 'user'}</td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4">No registered users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default RegisteredUsers;
