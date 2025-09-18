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
import { supabase } from './supabaseClient';
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin-session-token');
    const user = localStorage.getItem('admin-user');
    
    if (token && user) {
      try {
        setSession(JSON.parse(user));
      } catch (e) {
        console.error("Failed to parse admin user from localStorage", e);
        // Clear corrupted data
        localStorage.removeItem('admin-session-token');
        localStorage.removeItem('admin-user');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (adminUser) => {
    setSession(adminUser);
  };

  const handleLogout = async () => {
    localStorage.removeItem('admin-session-token');
    localStorage.removeItem('admin-user');
    await supabase.auth.signOut();
    setSession(null);
    // No need to navigate here, the component will re-render and redirect
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  // PrivateRoute component to protect dashboard routes
  const PrivateRoute = ({ children }) => {
    return session ? children : <Navigate to="/login" />;
  };

  return (
    <Router basename="/admin">
      <div className="app-container">
        {session && <Sidebar user={session} onLogout={handleLogout} />}
        <main className="main-content">
          <Routes>
            <Route path="/login" element={!session ? <LoginPage onLogin={handleLogin} /> : <Navigate to="/" />} />
            
            <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/users" element={<PrivateRoute><RegisteredUsers /></PrivateRoute>} />
            <Route path="/conversations" element={<PrivateRoute><Conversations /></PrivateRoute>} />
            <Route path="/documents" element={<PrivateRoute><ManageDocuments /></PrivateRoute>} />
            <Route path="/kb-settings" element={<PrivateRoute><KBSettings /></PrivateRoute>} />
            <Route path="/system-prompt" element={<PrivateRoute><SystemPrompt /></PrivateRoute>} />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App; 