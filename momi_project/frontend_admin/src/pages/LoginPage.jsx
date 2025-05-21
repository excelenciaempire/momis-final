import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
// import { useNavigate } from 'react-router-dom'; // Not strictly needed if App.jsx handles redirect
import './LoginPage.css'; // Keep for page-specific layout if any

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // const navigate = useNavigate(); // Not strictly needed

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (!supabase) {
        setError("Supabase client not available. Please check configuration.");
        setLoading(false);
        return;
    }
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      // Navigation will be handled by App.jsx due to session state change
      // navigate('/'); 
    } catch (err) {
      setError(err.error_description || err.message);
    }
    setLoading(false);
  };

  return (
    <div className="login-page-container"> {/* This class can center the form on the page */}
      <div className="card login-card"> {/* Use card style for the form box */}
        <h2 className="page-header text-center">Admin Login</h2> {/* Use page-header for title */}
        
        {error && <p className="error-message">{error}</p>}
        
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input 
              type="email" 
              id="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="you@example.com"
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
        {/* TODO: Link to password recovery or contact admin */}
      </div>
    </div>
  );
};

export default LoginPage; 