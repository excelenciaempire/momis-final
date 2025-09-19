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
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  
  const navigate = useNavigate()
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

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
        content: `Hi, I'm MOMi! 😊\nYour AI health coach, here to help you build the 7 Pillars of Wellness for you and your family. 🏠\nWhat do you need help with today?`,
        created_at: new Date().toISOString(),
        conversation_id: null
      }
      setMessages([welcomeMessage])
    } catch (error) {
      console.error('Error initializing chat:', error)
    }
  }, [])

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
  const sendMessage = useCallback(async (messageText = inputText, imageFile = selectedImage) => {
    if ((!messageText?.trim() && !imageFile) || isSending) return
    
    if (!isOnline) {
      toast.error('You are offline. Please check your connection.')
      return
    }

    setIsSending(true)
    
    let userMessage = {
      id: `user-${Date.now()}`,
      sender_type: 'user',
      content: messageText?.trim() || '',
      created_at: new Date().toISOString(),
      conversation_id: conversationId
    }

    // Handle image upload
    if (imageFile) {
      try {
        const formData = new FormData()
        formData.append('image', imageFile)
        
        const token = (await supabase.auth.getSession()).data.session?.access_token
        
        const uploadResponse = await axios.post('/api/chat/upload', formData, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        })
        
        userMessage.image_url = uploadResponse.data.imageUrl
        userMessage.content = messageText?.trim() || 'Shared an image'
      } catch (error) {
        console.error('Error uploading image:', error)
        toast.error('Failed to upload image')
        setIsSending(false)
        return
      }
    }

    setMessages(prev => [...prev, userMessage])
    setInputText('')
    setSelectedImage(null)
    setImagePreview('')

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      
      if (!token) {
        throw new Error('No authentication token available')
      }

      const requestData = {
        message: userMessage.content,
        conversation_id: conversationId
      }

      if (userMessage.image_url) {
        requestData.image_url = userMessage.image_url
      }

      const response = await axios.post('/api/chat/message', requestData, {
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
  }, [inputText, selectedImage, isSending, isOnline, conversationId, fetchConversations, navigate])

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const audioChunks = []

      recorder.ondataavailable = (event) => {
        audioChunks.push(event.data)
      }

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
        await transcribeAudio(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      recorder.start()
      setMediaRecorder(recorder)
      setIsRecording(true)
      toast.success('Recording started...')
    } catch (error) {
      console.error('Error starting recording:', error)
      toast.error('Could not start recording. Please check microphone permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
      setIsRecording(false)
      setMediaRecorder(null)
      toast.success('Recording stopped. Processing...')
    }
  }

  const transcribeAudio = async (audioBlob) => {
    setIsTranscribing(true)
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.wav')
      
      const token = (await supabase.auth.getSession()).data.session?.access_token
      
      const response = await axios.post('/api/chat/speech-to-text', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      })

      if (response.data.text) {
        setInputText(response.data.text)
        toast.success('Voice message transcribed!')
      }
    } catch (error) {
      console.error('Error transcribing audio:', error)
      toast.error('Failed to transcribe audio')
    } finally {
      setIsTranscribing(false)
    }
  }

  // Image handling
  const handleImageSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error('Image size should be less than 10MB')
        return
      }
      
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onload = (e) => setImagePreview(e.target.result)
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

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
    <div className="momi-chat-container">
      {/* Header */}
      <div className="momi-header">
        <div className="momi-header-content">
          <div className="momi-brand">
            <div className="momi-avatar">M</div>
            <div className="momi-info">
              <h1>MOMi</h1>
              <p>Your Wellness Assistant</p>
            </div>
          </div>
          <div className="user-info">
            <span>Hello, {userName}!</span>
            <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}></div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="momi-messages-area">
        <div className="momi-messages-container">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`momi-message-wrapper ${message.sender_type === 'user' ? 'user-message' : 'bot-message'}`}
            >
              <div className="momi-message-avatar">
                {message.sender_type === 'user' ? (
                  <div className="user-avatar">{userName.charAt(0).toUpperCase()}</div>
                ) : (
                  <div className="bot-avatar">M</div>
                )}
              </div>
              <div className="momi-message-bubble">
                {message.image_url && (
                  <img 
                    src={message.image_url} 
                    alt="Shared image" 
                    className="message-image"
                    style={{ maxWidth: '200px', borderRadius: '8px', marginBottom: '8px' }}
                  />
                )}
                <p>{message.content}</p>
                <small className="message-timestamp">
                  {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </small>
              </div>
            </div>
          ))}
          
          {isSending && (
            <div className="momi-message-wrapper bot-message">
              <div className="momi-message-avatar">
                <div className="bot-avatar">M</div>
              </div>
              <div className="momi-message-bubble typing">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Image Preview */}
      {imagePreview && (
        <div className="image-preview-container">
          <div className="image-preview">
            <img src={imagePreview} alt="Preview" />
            <button className="remove-image-btn" onClick={removeImage}>×</button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="momi-input-area">
        <div className="momi-input-container">
          <div className="input-actions">
            <button 
              className="action-btn voice-btn"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isTranscribing}
              title={isRecording ? "Stop recording" : "Start voice message"}
            >
              {isRecording ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2"></rect>
                </svg>
              ) : isTranscribing ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              )}
            </button>
            
            <button 
              className="action-btn image-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Upload image"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21,15 16,10 5,21"></polyline>
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
          </div>
          
          <div className="input-main">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isSending || !isOnline}
              rows="1"
              className="momi-textarea"
            />
            <button
              onClick={() => sendMessage()}
              disabled={(!inputText.trim() && !selectedImage) || isSending || !isOnline}
              className="send-btn"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Disclaimer */}
      <div className="momi-footer">
        <p>MOMi is an AI Chatbot. Information provided is not a substitute for professional medical advice. Always consult with a qualified healthcare provider for any health concerns.</p>
      </div>
    </div>
  )
}

export default ChatPage