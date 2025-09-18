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

// Styles
import './styles/global.css'
import './styles/components.css'

function App() {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    // Check initial session
    checkUserSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email)

      if (event === 'SIGNED_IN' && session?.user) {
        await loadUserData(session.user)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setUserProfile(null)
        setLoading(false)
      }

      setAuthChecked(true)
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const checkUserSession = async () => {
    try {
      setLoading(true)
      const currentUser = await getCurrentUser()

      if (currentUser) {
        await loadUserData(currentUser)
      }
    } catch (error) {
      console.error('Error checking user session:', error)
    } finally {
      setLoading(false)
      setAuthChecked(true)
    }
  }

  const loadUserData = async (authUser) => {
    try {
      const profile = await getUserProfile(authUser.id)
      setUser(authUser)
      setUserProfile(profile)
    } catch (error) {
      console.error('Error loading user data:', error)
      // If profile loading fails, sign out the user
      await supabase.auth.signOut()
    }
  }

  const handleRegistrationSuccess = async (authUser, profileData) => {
    console.log('Registration successful:', authUser.email)
    // User data will be loaded via auth state change listener
    // Redirect will happen in the routing logic
  }

  const handleLoginSuccess = async (authUser, profileData) => {
    console.log('Login successful:', authUser.email)
    // User data will be loaded via auth state change listener
    // Redirect will happen in the routing logic
  }

  // Show loading spinner while checking authentication
  if (loading || !authChecked) {
    return (
      <div className="app-loading">
        <div className="loading-container">
          <img
            src="/momi-icon-2.png"
            alt="MOMi Logo"
            className="loading-logo"
          />
          <div className="loading-spinner large"></div>
          <h2>Loading MOMi...</h2>
        </div>
      </div>
    )
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
                <RegistrationPage onRegistrationSuccess={handleRegistrationSuccess} />
              )
            }
          />

          <Route
            path="/login"
            element={
              user ? (
                <Navigate to="/chat" replace />
              ) : (
                <LoginPage onLoginSuccess={handleLoginSuccess} />
              )
            }
          />

          <Route path="/terms" element={<TermsPage />} />

          {/* Protected Routes */}
          <Route
            path="/chat"
            element={
              user && userProfile ? (
                <ChatPage user={user} userProfile={userProfile} />
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