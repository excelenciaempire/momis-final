import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabaseClient'
import toast from 'react-hot-toast'
import axios from 'axios'

const ChatPage = ({ user, userProfile }) => {
  console.log('ChatPage rendering with:', { user: user?.email, userProfile: userProfile?.first_name });
  
  if (!user) {
    console.log('ChatPage: No user provided');
    return <div>No user found</div>;
  }

  // State management
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [conversations, setConversations] = useState([])
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  
  const navigate = useNavigate()
  const messagesEndRef = useRef(null)

  // Get user display name
  const userName = userProfile?.first_name || user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'User'

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  // Initialize chat with welcome message
  const initializeChat = useCallback(async () => {
    try {
      const welcomeMessage = {
        id: `welcome-${Date.now()}`,
        sender_type: 'momi',
        content: `Hi ${userName}! 😊 I'm MOMi, your personalized wellness assistant. I'm here to support you with advice based on the 7 Pillars of Wellness. How can I help you today?`,
        created_at: new Date().toISOString(),
        conversation_id: null
      }
      setMessages([welcomeMessage])
    } catch (error) {
      console.error('Error initializing chat:', error)
    }
  }, [userName])

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!user?.id) return
    
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      
      if (!token) {
        console.error('No authentication token available')
        return
      }

      const response = await axios.get('/api/chat/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      const sortedConversations = response.data.sort((a, b) => 
        new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at)
      )
      
      setConversations(sortedConversations)
      console.log(`Loaded ${sortedConversations.length} conversations for ${userName}`)
    } catch (error) {
      console.error('Error fetching conversations:', error)
      if (error.response?.status === 401) {
        toast.error('Session expired. Please log in again.')
      }
    }
  }, [user?.id, userName])

  // Send message function
  const sendMessage = useCallback(async (messageText = inputText) => {
    if (!messageText?.trim() || isSending) return
    
    if (!isOnline) {
      toast.error('You are offline. Please check your connection.')
      return
    }

    setIsSending(true)
    const userMessage = {
      id: `user-${Date.now()}`,
      sender_type: 'user',
      content: messageText.trim(),
      created_at: new Date().toISOString(),
      conversation_id: conversationId
    }

    setMessages(prev => [...prev, userMessage])
    setInputText('')

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      
      if (!token) {
        throw new Error('No authentication token available')
      }

      const response = await axios.post('/api/chat/message', {
        message: messageText.trim(),
        conversation_id: conversationId
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000
      })

      if (response.data.conversation_id && !conversationId) {
        setConversationId(response.data.conversation_id)
      }

      if (response.data.reply) {
        const botMessage = {
          id: `momi-${Date.now()}`,
        sender_type: 'momi',
        content: response.data.reply,
          created_at: new Date().toISOString(),
          conversation_id: response.data.conversation_id
        }
        setMessages(prev => [...prev, botMessage])
      }

      // Refresh conversations list
      fetchConversations()

    } catch (error) {
      console.error('Error sending message:', error)

      // Remove the user message if sending failed
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id))
      
      if (error.response?.status === 401) {
        toast.error('Session expired. Please log in again.')
        navigate('/login')
      } else if (error.code === 'ECONNABORTED') {
        toast.error('Request timeout. Please try again.')
      } else {
        toast.error('Failed to send message. Please try again.')
      }
    } finally {
      setIsSending(false)
    }
  }, [inputText, isSending, isOnline, conversationId, fetchConversations, navigate])

  // Effects
  useEffect(() => {
    initializeChat()
    fetchConversations()
  }, [initializeChat, fetchConversations])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Network status listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      toast.success('Connection restored')
    }

    const handleOffline = () => {
      setIsOnline(false)
      toast.error('Connection lost. Some features may not work.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Handle input key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Start new conversation
  const startNewConversation = () => {
    setConversationId(null)
    initializeChat()
    setIsMenuOpen(false)
  }

  return (
    <div className="chat-page-fullscreen">
      {/* Header */}
      <div className="chat-header">
        <div className="header-left">
          <button className="menu-btn" onClick={() => setIsMenuOpen(true)}>
            ☰
          </button>
          <h1>🤖 MOMi Chat</h1>
        </div>
        <div className="header-right">
          <span className="user-name">Hello, {userName}!</span>
          <div className={`connection-status ${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? '🟢' : '🔴'}
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="messages-container">
        <div className="messages-list">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.sender_type === 'user' ? 'user-message' : 'momi-message'}`}
            >
              <div className="message-content">
                <p>{message.content}</p>
                <small className="message-time">
                  {new Date(message.created_at).toLocaleTimeString()}
                </small>
              </div>
            </div>
          ))}
          {isSending && (
            <div className="message momi-message">
              <div className="message-content typing-indicator">
                <p>MOMi is typing...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
          </div>

      {/* Input Area */}
      <div className="input-container">
        <div className="input-wrapper">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
            placeholder={isOnline ? "Type your message here..." : "You are offline..."}
            disabled={isSending || !isOnline}
              rows="1"
            className="message-input"
            />
            <button
              onClick={() => sendMessage()}
            disabled={!inputText.trim() || isSending || !isOnline}
            className="send-button"
          >
            {isSending ? '⏳' : '📤'}
            </button>
        </div>
      </div>

      {/* Conversations Menu */}
      {isMenuOpen && (
        <div className="menu-overlay" onClick={() => setIsMenuOpen(false)}>
          <div className="conversations-menu" onClick={(e) => e.stopPropagation()}>
            <div className="menu-header">
              <h3>💬 Your Conversations</h3>
              <button className="menu-close" onClick={() => setIsMenuOpen(false)}>×</button>
            </div>
            
            <div className="menu-actions">
              <button className="new-chat-btn" onClick={startNewConversation}>
                ➕ Start New Chat
              </button>
            </div>

            <div className="conversations-list">
              {conversations.length === 0 && (
                <p className="no-conversations">No previous conversations found. Start chatting to create your first conversation!</p>
              )}
              
              {conversations.map((conv) => (
                <div 
                  key={conv.id} 
                  className="conversation-item"
                  onClick={() => {
                    setConversationId(conv.id)
                    setIsMenuOpen(false)
                    // Load conversation messages here
                  }}
                >
                  <div className="conversation-preview">
                    <strong>{conv.title || 'Wellness Chat'}</strong>
                    <p>{conv.last_message_preview || 'Click to continue...'}</p>
                    <small>{new Date(conv.last_message_at || conv.created_at).toLocaleDateString()}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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