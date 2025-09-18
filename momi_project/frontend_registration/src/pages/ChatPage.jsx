import React, { useState, useEffect } from 'react'
import { supabase, getCurrentUser } from '../utils/supabaseClient'
import toast from 'react-hot-toast'

const ChatPage = ({ user, userProfile }) => {
  const [isLoadingChat, setIsLoadingChat] = useState(true)
  const [chatError, setChatError] = useState(null)

  useEffect(() => {
    // Load the chat widget
    loadChatWidget()
  }, [])

  const loadChatWidget = async () => {
    try {
      setIsLoadingChat(true)
      setChatError(null)

      // Verify user session
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        setChatError('User session expired. Please log in again.')
        window.location.href = '/login'
        return
      }

      // Load chat widget script dynamically
      const script = document.createElement('script')
      script.src = '/widget/assets/widget-loader.js'
      script.type = 'module'
      script.async = true
      script.crossOrigin = 'anonymous'

      script.onload = () => {
        // Initialize chat with user context
        initializeChatWithUser(currentUser, userProfile)
        setIsLoadingChat(false)
      }

      script.onerror = () => {
        setChatError('Failed to load chat widget. Please refresh the page.')
        setIsLoadingChat(false)
      }

      document.head.appendChild(script)

      // Load CSS
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = '/widget/assets/widget-styles.css'
      document.head.appendChild(link)

    } catch (error) {
      console.error('Error loading chat widget:', error)
      setChatError('An error occurred while loading the chat. Please refresh the page.')
      setIsLoadingChat(false)
    }
  }

  const initializeChatWithUser = (user, profile) => {
    // Set user context for the chat widget
    if (window.MOMiChat) {
      window.MOMiChat.setUser({
        userId: user.id,
        email: user.email,
        profile: profile,
        isAuthenticated: true
      })
    }

    // Configure chat for full-page mode
    const chatContainer = document.getElementById('momi-chat-container')
    if (chatContainer) {
      chatContainer.style.height = '100vh'
      chatContainer.style.width = '100%'
      chatContainer.classList.add('fullpage-mode')
    }
  }

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Logout error:', error)
        toast.error('Failed to log out properly')
      } else {
        toast.success('Logged out successfully')
        window.location.href = '/login'
      }
    } catch (error) {
      console.error('Unexpected logout error:', error)
      toast.error('An unexpected error occurred during logout')
    }
  }

  if (isLoadingChat) {
    return (
      <div className="chat-loading">
        <div className="loading-container">
          <div className="loading-spinner large"></div>
          <h2>Loading your MOMi chat...</h2>
          <p>Getting everything ready for your personalized wellness support.</p>
        </div>
      </div>
    )
  }

  if (chatError) {
    return (
      <div className="chat-error">
        <div className="error-container">
          <h2>Oops! Something went wrong</h2>
          <p>{chatError}</p>
          <div className="error-actions">
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary"
            >
              Refresh Page
            </button>
            <button
              onClick={handleLogout}
              className="btn btn-outline"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-page">
      {/* User Header */}
      <div className="chat-header">
        <div className="user-info">
          <img
            src="/momi-icon-2.png"
            alt="MOMi"
            className="momi-avatar"
          />
          <div className="user-details">
            <h3>Welcome, {userProfile?.first_name || user?.email}!</h3>
            <p>Your personalized wellness assistant is ready</p>
          </div>
        </div>
        <div className="header-actions">
          <button
            onClick={() => {
              // Reset conversation if needed
              if (window.MOMiChat && window.MOMiChat.resetConversation) {
                window.MOMiChat.resetConversation()
              }
            }}
            className="btn btn-secondary btn-small"
          >
            New Conversation
          </button>
          <button
            onClick={handleLogout}
            className="btn btn-outline btn-small"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Chat Container */}
      <div id="momi-chat-container" className="chat-container">
        {/* Chat widget will be loaded here */}
      </div>

      {/* Footer */}
      <div className="chat-footer">
        <p className="disclaimer">
          <strong>Disclaimer:</strong> MOMi is an AI assistant and does not provide medical advice.
          Always consult with healthcare professionals for medical concerns.
        </p>
      </div>
    </div>
  )
}

export default ChatPage