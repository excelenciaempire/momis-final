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
    return session ? children : <Navigate to="/" />;
  };

  return (
    <Router basename="/admin">
      <div className="admin-app-container">
        <Routes>
          {session ? (
            <>
              <Route path="/" element={
                <div className="admin-layout">
                  <Sidebar user={session} onLogout={handleLogout} />
                  <main className="admin-main-content">
                    <Dashboard />
                  </main>
                </div>
              } />
              <Route path="/users" element={
                <div className="admin-layout">
                  <Sidebar user={session} onLogout={handleLogout} />
                  <main className="admin-main-content">
                    <RegisteredUsers />
                  </main>
                </div>
              } />
              <Route path="/conversations" element={
                <div className="admin-layout">
                  <Sidebar user={session} onLogout={handleLogout} />
                  <main className="admin-main-content">
                    <Conversations />
                  </main>
                </div>
              } />
              <Route path="/documents" element={
                <div className="admin-layout">
                  <Sidebar user={session} onLogout={handleLogout} />
                  <main className="admin-main-content">
                    <ManageDocuments />
                  </main>
                </div>
              } />
              <Route path="/kb-settings" element={
                <div className="admin-layout">
                  <Sidebar user={session} onLogout={handleLogout} />
                  <main className="admin-main-content">
                    <KBSettings />
                  </main>
                </div>
              } />
              <Route path="/system-prompt" element={
                <div className="admin-layout">
                  <Sidebar user={session} onLogout={handleLogout} />
                  <main className="admin-main-content">
                    <SystemPrompt />
                  </main>
                </div>
              } />
              <Route path="*" element={<Navigate to="/" />} />
            </>
          ) : (
            <>
              <Route path="/" element={<LoginPage onLogin={handleLogin} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </>
          )}
        </Routes>
      </div>
    </Router>
  );
}

export default App; 