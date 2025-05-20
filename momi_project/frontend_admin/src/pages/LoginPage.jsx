import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (!supabase) {
        setError("Supabase client not available.");
        setLoading(false);
        return;
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Navigation will be handled by App.jsx due to session state change
      // navigate('/'); // Navigate to dashboard after successful login
    } catch (error) {
      setError(error.error_description || error.message);
    }
    setLoading(false);
  };

  return (
    <div className="login-page-container">
      <form onSubmit={handleLogin} className="login-form">
        <h2>Admin Login</h2>
        {error && <p className="error-message">{error}</p>}
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button type="submit" disabled={loading} className="login-button">
          {loading ? 'Logging in...' : 'Login'}
        </button>
        {/* TODO: Add Sign Up for initial admin or forgot password if needed */}
      </form>
    </div>
  );
};

export default LoginPage; 