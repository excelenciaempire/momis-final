import React, { useState, useEffect, useRef } from 'react'
import { supabase, getCurrentUser } from '../utils/supabaseClient'
import toast from 'react-hot-toast'
import axios from 'axios'

const ChatPage = ({ user, userProfile }) => {
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [conversations, setConversations] = useState([])
  const [loadingConversations, setLoadingConversations] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    initializeChat()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const initializeChat = async () => {
    try {
      // Get welcome message
      const response = await axios.get('/api/chat/settings')
      const welcomeMessage = {
        id: Date.now(),
        sender_type: 'momi',
        content: `Hi ${userProfile?.first_name || 'there'}! 😊 I'm MOMi, your personalized wellness assistant. I'm here to support you with advice based on the 7 Pillars of Wellness. How can I help you today?`,
        timestamp: new Date().toISOString()
      }
      setMessages([welcomeMessage])
    } catch (error) {
      console.error('Error initializing chat:', error)
    }
  }

  const fetchConversations = async () => {
    if (!user?.id) return
    
    try {
      setLoadingConversations(true)
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const response = await axios.get(`/api/chat/conversations/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setConversations(response.data)
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setLoadingConversations(false)
    }
  }

  const sendMessage = async () => {
    if (!inputText.trim() || isSending) return

    const userMessage = {
      id: Date.now(),
      sender_type: 'user',
      content: inputText,
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setIsSending(true)
    const messageText = inputText
    setInputText('')

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const response = await axios.post('/api/chat/message', {
        message: messageText,
        userId: user.id,
        conversationId: conversationId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const momiMessage = {
        id: Date.now() + 1,
        sender_type: 'momi',
        content: response.data.reply,
        timestamp: new Date().toISOString()
      }

      setMessages(prev => [...prev, momiMessage])
      if (response.data.conversationId && !conversationId) {
        setConversationId(response.data.conversationId)
      }

    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const startNewConversation = () => {
    setMessages([])
    setConversationId(null)
    setIsMenuOpen(false)
    initializeChat()
  }

  const loadConversation = async (convId) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const response = await axios.get(`/api/chat/history/${convId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setMessages(response.data)
      setConversationId(convId)
      setIsMenuOpen(false)
    } catch (error) {
      console.error('Error loading conversation:', error)
      toast.error('Failed to load conversation')
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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="chat-page">
      {/* Header with hamburger menu */}
      <div className="chat-header">
        <div className="user-info">
          <img src="/momi-icon-2.png" alt="MOMi" className="momi-avatar" />
          <div className="user-details">
            <h3>Welcome, {userProfile?.first_name || 'Usuario'}!</h3>
            <p>Your personalized wellness assistant is ready</p>
          </div>
        </div>
        <div className="header-actions">
          <button
            onClick={() => {
              setIsMenuOpen(!isMenuOpen)
              if (!isMenuOpen) fetchConversations()
            }}
            className="hamburger-btn"
            title="Chat History"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <button onClick={startNewConversation} className="btn btn-secondary btn-small">
            New Chat
          </button>
          <button onClick={handleLogout} className="btn btn-outline btn-small">
            Logout
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="chat-main">
        <div className="messages-container">
          {messages.map((message) => (
            <div key={message.id} className={`message ${message.sender_type}`}>
              <div className="message-avatar">
                {message.sender_type === 'momi' ? (
                  <img src="/momi-icon-2.png" alt="MOMi" />
                ) : (
                  <div className="user-avatar">{userProfile?.first_name?.[0] || 'U'}</div>
                )}
              </div>
              <div className="message-content">
                <div className="message-text">{message.content}</div>
                <div className="message-time">
                  {new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            </div>
          ))}
          {isSending && (
            <div className="message momi">
              <div className="message-avatar">
                <img src="/momi-icon-2.png" alt="MOMi" />
              </div>
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="input-container">
          <div className="input-wrapper">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="message-input"
              rows="1"
              disabled={isSending}
            />
            <button
              onClick={sendMessage}
              disabled={!inputText.trim() || isSending}
              className="send-button"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22,2 15,22 11,13 2,9"></polygon>
              </svg>
            </button>
          </div>
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
              {loadingConversations && <p>Loading conversations...</p>}
              
              {!loadingConversations && conversations.length === 0 && (
                <p className="no-conversations">No previous conversations found. Start chatting to create your first conversation!</p>
              )}
              
              {conversations.map((conv) => (
                <div 
                  key={conv.id} 
                  className="conversation-item"
                  onClick={() => loadConversation(conv.id)}
                >
                  <div className="conv-preview">
                    <span className="conv-date">
                      {new Date(conv.created_at).toLocaleDateString()}
                    </span>
                    <span className="conv-time">
                      {new Date(conv.last_message_at || conv.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <div className="conv-snippet">
                    Chat from {new Date(conv.created_at).toLocaleDateString()}
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