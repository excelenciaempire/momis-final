import React, { useState } from 'react';
import apiClient from '../apiClient'; // Import the axios client
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';

const LoginPage = ({ onLogin }) => { // Accept onLogin prop to update session state in App
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Call the backend admin login endpoint
      const response = await apiClient.post('/admin/auth/login', { email, password });
      
      const { sessionToken, admin } = response.data;
      
      // Store the token in localStorage
      localStorage.setItem('admin-session-token', sessionToken);
      localStorage.setItem('admin-user', JSON.stringify(admin));
      console.log('Admin session token saved:', sessionToken); // DEBUG: Verify token is saved

      // Notify parent component about the successful login
      onLogin(admin);
      
      // Navigate to the dashboard
      navigate('/');

    } catch (err) {
      setError(err.response?.data?.error || err.message || 'An unexpected error occurred.');
    }
    setLoading(false);
  };

  return (
    <div className="login-page-container">
      <div className="card login-card">
        <h2 className="page-header text-center">MOMI Admin Login</h2>
        
        {error && <p className="error-message">{error}</p>}
        
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input 
              type="email" 
              id="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="admin@example.com"
              required 
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input 
              type="password" 
              id="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="••••••••"
              required 
            />
          </div>
          <button type="submit" disabled={loading} className="button" style={{ width: '100%' }}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage; 