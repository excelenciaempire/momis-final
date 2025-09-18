import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './pages/Sidebar';
import Dashboard from './pages/Dashboard';
import RegisteredUsers from './pages/RegisteredUsers';
import Conversations from './pages/Conversations';
import ManageDocuments from './pages/ManageDocuments';
import KBSettings from './pages/KBSettings';
import SystemPrompt from './pages/SystemPrompt';
import LoginPage from './pages/LoginPage';
import { supabase } from './supabaseClient'; // Import supabase client
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for admin session token
    const token = localStorage.getItem('admin-session-token');
    const user = localStorage.getItem('admin-user');
    
    if (token && user) {
      setSession(JSON.parse(user));
    }
    setLoading(false);
  }, []);

  const handleLogin = (adminUser) => {
    setSession(adminUser);
  };

  const handleLogout = async () => {
    localStorage.removeItem('admin-session-token');
    localStorage.removeItem('admin-user');
    await supabase.auth.signOut(); // Clear supabase session to prevent cross-app login
    setSession(null);
  };

  if (loading) {
    return <div>Loading...</div>; // Or a proper spinner component
  }

  return (
    <Router>
      <div className="app-container">
        {session && <Sidebar user={session} onLogout={handleLogout} />}
        <main className="main-content">
          <Routes>
            {!session ? (
              <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
            ) : (
              <>
                <Route path="/" element={<Dashboard />} />
                <Route path="/users" element={<RegisteredUsers />} />
                <Route path="/conversations" element={<Conversations />} />
                <Route path="/documents" element={<ManageDocuments />} />
                <Route path="/kb-settings" element={<KBSettings />} />
                <Route path="/system-prompt" element={<SystemPrompt />} />
              </>
            )}
            {/* Redirect any other path to login or dashboard depending on session */}
            <Route path="*" element={<Navigate to={session ? "/" : "/login"} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App; 