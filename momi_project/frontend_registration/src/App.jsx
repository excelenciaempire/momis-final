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
  const [loading, setLoading] = useState(true)
  const [profileLoaded, setProfileLoaded] = useState(false) // Track profile loading separately

  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          await loadUserProfile(currentUser);
        }
      } catch (error) {
        console.error('Error checking user session:', error);
      } finally {
        setLoading(false);
      }
    };

    checkUserSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      const currentUser = session?.user;
      setUser(currentUser);
      if (currentUser) {
        await loadUserProfile(currentUser);
      } else {
        setUserProfile(null);
        setProfileLoaded(true);
      }
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const loadUserProfile = async (authUser) => {
    setProfileLoaded(false);
    try {
      const profile = await getUserProfile(authUser.id);
      setUserProfile(profile);
    } catch (error) {
      console.error('Error loading user profile:', error);
      // Fallback profile if loading fails
      setUserProfile({
        auth_user_id: authUser.id,
        email: authUser.email,
        first_name: authUser.user_metadata?.first_name || 'User',
      });
    } finally {
      setProfileLoaded(true);
    }
  };

  const handleAuthSuccess = (authUser, profileData) => {
    setUser(authUser);
    setUserProfile(profileData);
    setProfileLoaded(true);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <img src="/momi-icon-2.png" alt="MOMi Loading" className="loading-icon" />
        <p>Loading MOMi...</p>
      </div>
    );
  }

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
                <div className="loading-container">
                  <img src="/momi-icon-2.png" alt="MOMi Loading" className="loading-icon" />
                  <p>Loading Profile...</p>
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