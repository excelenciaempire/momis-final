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
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    // Check initial session quickly
    checkUserSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email)

      if (event === 'SIGNED_IN' && session?.user) {
        // Set user immediately for instant redirect
        setUser(session.user)
        setLoading(false)
        setAuthChecked(true)

        // Load profile asynchronously in background (don't wait for it)
        loadUserProfile(session.user)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setUserProfile(null)
        setLoading(false)
        setAuthChecked(true)
      }
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const checkUserSession = async () => {
    try {
      // Quick timeout for faster initial load
      const userPromise = getCurrentUser()
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Session check timeout')), 2000)
      )

      const currentUser = await Promise.race([userPromise, timeoutPromise])

      if (currentUser) {
        setUser(currentUser)
        setLoading(false)
        setAuthChecked(true)

        // Load profile immediately (not asynchronously)
        await loadUserProfile(currentUser)
      } else {
        setLoading(false)
        setAuthChecked(true)
      }
    } catch (error) {
      console.error('Error checking user session:', error)
      // If session check fails/times out, assume no user
      setUser(null)
      setUserProfile(null)
      setLoading(false)
      setAuthChecked(true)
    }
  }

  const loadUserProfile = async (authUser) => {
    try {
      // Add timeout to profile loading too
      const profilePromise = getUserProfile(authUser.id)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile load timeout')), 3000)
      )

      const profile = await Promise.race([profilePromise, timeoutPromise])
      setUserProfile(profile)
    } catch (error) {
      console.error('Error loading user profile:', error)
      // Create a basic profile if loading fails
      setUserProfile({
        auth_user_id: authUser.id,
        email: authUser.email,
        first_name: authUser.user_metadata?.first_name || 'User',
        last_name: authUser.user_metadata?.last_name || '',
        family_roles: [],
        children_count: 0,
        main_concerns: [],
        dietary_preferences: [],
        personalized_support: false
      })
    }
  }

  const handleRegistrationSuccess = async (authUser, profileData) => {
    console.log('Registration successful:', authUser.email)
    setUser(authUser)
    setUserProfile(profileData)
    setLoading(false)
    setAuthChecked(true)
  }

  const handleLoginSuccess = async (authUser, profileData) => {
    console.log('Login successful:', authUser.email)
    setUser(authUser)
    setUserProfile(profileData || {
      auth_user_id: authUser.id,
      email: authUser.email,
      first_name: authUser.user_metadata?.first_name || 'User',
      last_name: authUser.user_metadata?.last_name || '',
      family_roles: [],
      children_count: 0,
      main_concerns: [],
      dietary_preferences: [],
      personalized_support: false
    })
    // Immediately stop loading and mark auth as checked
    setLoading(false)
    setAuthChecked(true)
  }

  // Quick auth check - minimal loading time
  if (!authChecked) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #ffffff 0%, #f8f4ff 100%)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <img
            src="/momi-icon-2.png"
            alt="MOMi"
            style={{
              width: '40px',
              marginBottom: '12px',
              opacity: '0.8'
            }}
          />
          <div style={{
            color: '#6B46C1',
            fontSize: '12px',
            fontWeight: '400',
            opacity: '0.7'
          }}>
            Loading...
          </div>
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
          {/* <Route path="/email-confirmation" element={<EmailConfirmationPage />} /> */}

          {/* Protected Routes */}
          <Route
            path="/chat"
            element={
              user ? (
                <ChatPage user={user} userProfile={userProfile || {
                  auth_user_id: user.id,
                  email: user.email,
                  first_name: user.user_metadata?.first_name || 'User',
                  last_name: user.user_metadata?.last_name || '',
                  family_roles: [],
                  children_count: 0,
                  main_concerns: [],
                  dietary_preferences: [],
                  personalized_support: false
                }} />
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