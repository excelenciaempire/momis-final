import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, NavLink } from 'react-router-dom';
import { supabase } from './supabaseClient';
import LoginPage from './pages/LoginPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ManageDocumentsPage from './pages/ManageDocumentsPage';
import SystemSettingsPage from './pages/SystemSettingsPage';
import UserManagementPage from './pages/UserManagementPage';
import RegisteredUsersPage from './pages/RegisteredUsersPage';
import KnowledgeBaseSettingsPage from './pages/KnowledgeBaseSettingsPage';
import './App.css'; // General admin styles

// Component for Unauthorized Access
const UnauthorizedPage = () => (
  <div style={{ padding: '20px', textAlign: 'center' }}>
    <h1>Unauthorized</h1>
    <p>You do not have permission to access this page.</p>
    <p>Please contact an administrator if you believe this is an error.</p>
    <NavLink to="/login">Go to Login</NavLink>
  </div>
);

// Protected Route Component for Admin Areas
const ProtectedRoute = ({ session, userRole }) => {
  // TEMPORARILY BYPASSING AUTH FOR PREVIEW - REMEMBER TO RE-ENABLE
  // console.log("Admin ProtectedRoute: Bypassing auth for preview. Current session:", session, "Current role:", userRole);
  // return <AdminLayout session={session} />;

  // Original logic (re-enable for production/security):
  if (!session) return <Navigate to="/login" replace />;
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
  };

  return (
    <div className="admin-layout">
      <nav className="admin-nav">
        <div className="admin-nav-header">MOMi Admin</div>
        <NavLink to="/" end>Dashboard</NavLink>

        {/* User Management Section */}
        <div className="nav-section-header">Users</div>
        <NavLink to="/users">Registered Users</NavLink>
        <NavLink to="/conversations">Conversations</NavLink>

        {/* Knowledge Section Links */}
        <div className="nav-section-header">Knowledge</div> 
        <NavLink to="/knowledge/documents">Manage Documents</NavLink>
        <NavLink to="/knowledge/kb-settings">KB Settings</NavLink>
        <NavLink to="/knowledge/settings">System Prompt</NavLink>
        
        {session?.user && (
          <button onClick={handleLogout} className="logout-button">
            Logout ({session.user.email.substring(0,10)}...)
          </button>
        )}
      </nav>
      <main className="admin-main-content">
        <Outlet /> 
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
      try {
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        setSession(currentSession);

        if (currentSession?.user?.app_metadata?.roles?.includes('admin')) {
          setUserRole('admin');
        } else if (currentSession) {
          setUserRole(currentSession?.user?.app_metadata?.roles?.[0] || 'user');
        } else {
          setUserRole(null);
        }
      } catch (e) {
        console.error("Error getting session and role:", e);
        setUserRole(null); // Ensure userRole is null on error
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
        } else {
          setUserRole(null);
        }
        if (_event === "SIGNED_OUT") setLoading(false); 
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
            <Route path="/users" element={<RegisteredUsersPage />} />
            <Route path="/conversations" element={<UserManagementPage />} />
            <Route path="/knowledge/documents" element={<ManageDocumentsPage />} />
            <Route path="/knowledge/kb-settings" element={<KnowledgeBaseSettingsPage />} />
            <Route path="/knowledge/settings" element={<SystemSettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to={(session && userRole === 'admin') ? "/" : "/login"} replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App; 