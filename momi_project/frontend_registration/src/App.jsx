import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { supabase, getCurrentUser, getUserProfile } from './utils/supabaseClient'

// Pages
import RegistrationPage from './pages/RegistrationPage'
import LoginPage from './pages/LoginPage'
import ChatPage from './pages/ChatPage'
import TermsPage from './pages/TermsPage'
import LandingPage from './pages/LandingPage'
import EmailConfirmationPage from './pages/EmailConfirmationPage'

// Styles
import './styles/global.css'
import './styles/components.css'

function App() {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [profileLoaded, setProfileLoaded] = useState(false) // Track profile loading separately

  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const currentUser = await getCurrentUser();
        console.log('Initial user check:', currentUser?.email || 'No user');
        
        if (currentUser) {
          setUser(currentUser);
          // Load profile immediately without blocking
          loadUserProfile(currentUser);
        }
      } catch (error) {
        console.error('Error checking user session:', error);
      }
    };

    checkUserSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email || 'No user');
      
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        // Load profile immediately
        loadUserProfile(session.user);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserProfile(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const loadUserProfile = async (authUser) => {
    setProfileLoaded(false);
    
    try {
      console.log('Loading profile for user:', authUser.id);
      
      // Load profile with optimized query (no timeout - let it load properly)
      const profile = await getUserProfile(authUser.id);
      
      if (profile) {
        console.log('Profile loaded successfully:', profile.first_name);
        setUserProfile(profile);
        setProfileLoaded(true);
      } else {
        // If no profile exists, create a minimal one but still mark as loaded
        console.log('No profile found, creating minimal fallback');
        const fallbackProfile = {
          auth_user_id: authUser.id,
          email: authUser.email,
          first_name: authUser.user_metadata?.first_name || authUser.email?.split('@')[0] || 'User',
          last_name: authUser.user_metadata?.last_name || '',
          family_roles: [],
          children_count: 0,
          main_concerns: [],
          dietary_preferences: [],
          personalized_support: false
        };
        setUserProfile(fallbackProfile);
        setProfileLoaded(true);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      // Even on error, set a fallback and mark as loaded to avoid infinite loading
      const fallbackProfile = {
        auth_user_id: authUser.id,
        email: authUser.email,
        first_name: authUser.user_metadata?.first_name || authUser.email?.split('@')[0] || 'User',
        last_name: authUser.user_metadata?.last_name || '',
        family_roles: [],
        children_count: 0,
        main_concerns: [],
        dietary_preferences: [],
        personalized_support: false
      };
      setUserProfile(fallbackProfile);
      setProfileLoaded(true);
    }
  };

  const handleAuthSuccess = (authUser, profileData) => {
    setUser(authUser);
    setUserProfile(profileData);
    setProfileLoaded(true);
  };

  return (
    <Router>
      <div className="app">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'white',
              color: '#333',
              border: '1px solid #EBC7F2',
              borderRadius: '8px',
            },
            success: {
              iconTheme: {
                primary: '#913D9A',
                secondary: 'white',
              },
            },
            error: {
              iconTheme: {
                primary: '#EF4444',
                secondary: 'white',
              },
            },
          }}
        />

        <Routes>
          {/* Public Routes */}
          <Route
            path="/"
            element={
              user ? (
                <Navigate to="/chat" replace />
              ) : (
                <LandingPage />
              )
            }
          />

          <Route
            path="/register"
            element={
              user ? (
                <Navigate to="/chat" replace />
              ) : (
                <RegistrationPage onRegistrationSuccess={handleAuthSuccess} />
              )
            }
          />

          <Route
            path="/login"
            element={
              user ? (
                <Navigate to="/chat" replace />
              ) : (
                <LoginPage onLoginSuccess={handleAuthSuccess} />
              )
            }
          />

          <Route path="/terms" element={<TermsPage />} />
          {/* <Route path="/email-confirmation" element={<EmailConfirmationPage />} /> */}

          {/* Protected Routes */}
          <Route
            path="/chat"
            element={
              user && profileLoaded ? (
                <ChatPage user={user} userProfile={userProfile} />
              ) : user && !profileLoaded ? (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  height: '100vh',
                  background: '#f8fafc'
                }}>
                  <div style={{ 
                    textAlign: 'center',
                    animation: 'fadeIn 0.3s ease-in'
                  }}>
                    <div style={{ 
                      fontSize: '32px', 
                      marginBottom: '12px',
                      animation: 'pulse 1s infinite'
                    }}>🤖</div>
                    <div style={{ 
                      color: '#64748b', 
                      fontSize: '16px',
                      fontWeight: '500'
                    }}>
                      Personalizing your experience...
                    </div>
                  </div>
                </div>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* Catch all route */}
          <Route
            path="*"
            element={
              <div className="not-found">
                <div className="container">
                  <h1>Page Not Found</h1>
                  <p>The page you're looking for doesn't exist.</p>
                  <a href="/" className="btn btn-primary">
                    Go Home
                  </a>
                </div>
              </div>
            }
          />
        </Routes>
      </div>
    </Router>
  )
}

export default App