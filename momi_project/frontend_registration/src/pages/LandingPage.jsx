import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const LandingPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Attempt to sign out any lingering sessions first to ensure a clean login.
    // This helps prevent conflicts if an admin session was active.
    await supabase.auth.signOut();

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Logged in successfully!');
      navigate('/chat');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <img
            src="/momi-icon-2.png" // Make sure this path is correct in your public folder
            alt="MOMi Logo"
            className="auth-logo"
          />
          <h1 className="auth-title">Welcome to MOMi</h1>
          <p className="auth-subtitle">Your AI-Powered Wellness Assistant</p>

          <form onSubmit={handleLogin} className="auth-form">
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
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          
          <div className="auth-footer">
            <p>
              No account yet? <Link to="/register">Create one here</Link>
            </p>
          </div>
        </div>
        <div className="landing-footer">
           <a href="/terms">Terms & Conditions</a>
             <span>•</span>
             <a href="https://7pillarsmission.com" target="_blank" rel="noopener noreferrer">
               MOMS on a Mission
             </a>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;