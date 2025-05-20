import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import LoginPage from './pages/LoginPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ManageDocumentsPage from './pages/ManageDocumentsPage';
import SystemSettingsPage from './pages/SystemSettingsPage';
import UserManagementPage from './pages/UserManagementPage';
import './App.css'; // General admin styles

// Component for Unauthorized Access
const UnauthorizedPage = () => (
  <div style={{ padding: '20px', textAlign: 'center' }}>
    <h1>Unauthorized</h1>
    <p>You do not have permission to access this page.</p>
    <p>Please contact an administrator if you believe this is an error.</p>
    <Link to="/login">Go to Login</Link>
  </div>
);

// Protected Route Component for Admin Areas
const ProtectedRoute = ({ session, userRole }) => {
  if (!session) return <Navigate to="/login" replace />;
  // Check if the user has the 'admin' role
  if (userRole !== 'admin') {
    console.warn("User does not have admin role. Current role:", userRole);
    return <Navigate to="/unauthorized" replace />;
  }
  return <AdminLayout session={session} />;
};

// Basic Layout for Authenticated Admin Routes
const AdminLayout = ({ session }) => {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Navigate to login or rely on ProtectedRoute to redirect
  };

  return (
    <div className="admin-layout">
      <nav className="admin-nav">
        <Link to="/">Dashboard / Analytics</Link>
        <Link to="/users">User Management</Link>
        <Link to="/documents">Manage Documents</Link>
        <Link to="/settings">System Settings</Link>
        <button onClick={handleLogout} className="logout-button">Logout ({session?.user?.email?.substring(0,10)}...)</button>
      </nav>
      <main className="admin-main-content">
        <Outlet /> {/* Child routes will render here */}
      </main>
    </div>
  );
};

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null); // State for user role

  useEffect(() => {
    if (!supabase) {
        setLoading(false);
        console.error("Supabase client not initialized in Admin Panel.");
        return;
    }

    const getSessionAndRole = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);

      if (currentSession?.user?.app_metadata?.roles?.includes('admin')) {
        setUserRole('admin');
      } else if (currentSession) {
        // If user is logged in but no 'admin' role or roles array doesn't exist
        setUserRole(currentSession?.user?.app_metadata?.roles?.[0] || 'user'); // Assign first role or default to 'user'
        console.log('User role set to:', currentSession?.user?.app_metadata?.roles?.[0] || 'user');
      } else {
        setUserRole(null);
      }
      setLoading(false);
    };

    getSessionAndRole();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        if (newSession?.user?.app_metadata?.roles?.includes('admin')) {
          setUserRole('admin');
        } else if (newSession) {
          setUserRole(newSession?.user?.app_metadata?.roles?.[0] || 'user');
          console.log('User role updated to:', newSession?.user?.app_metadata?.roles?.[0] || 'user');
        } else {
          setUserRole(null);
        }
        // Ensure loading is false on auth state change, especially logout
        if (_event === "SIGNED_OUT") setLoading(false); 
        // if (_event === "INITIAL_SESSION" || _event === "SIGNED_IN") setLoading(false); // also ensure loading is false after initial check or sign in
      }
    );
    return () => authListener.subscription.unsubscribe();
  }, []);

  // How to set admin role in Supabase:
  // 1. Go to your Supabase Dashboard.
  // 2. Navigate to Authentication > Users.
  // 3. Select the user you want to make an admin.
  // 4. Under "User Management", find the "User App Metadata" section.
  // 5. Add or edit the JSON to include: { "roles": ["admin"] }
  // Note: The backend admin middleware (`momi_project/backend/middleware/authAdmin.js`)
  // also relies on `app_metadata.roles` containing 'admin'.

  if (loading) { // Show loading spinner while session and role are being determined
    return <div className="loading-admin">Loading Admin Panel...</div>;
  }

  return (
    <Router basename="/admin"> {/* Optional: if admin panel is served under /admin path */}
      <div className="admin-app-container">
        <Routes>
          <Route path="/login" element={!session ? <LoginPage /> : <Navigate to="/" replace />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route element={<ProtectedRoute session={session} userRole={userRole} />}>
            <Route path="/" element={<AnalyticsPage />} />
            <Route path="/users" element={<UserManagementPage />} />
            <Route path="/documents" element={<ManageDocumentsPage />} />
            <Route path="/settings" element={<SystemSettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to={session && userRole === 'admin' ? "/" : "/login"} replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App; 