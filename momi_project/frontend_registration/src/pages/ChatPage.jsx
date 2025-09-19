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
    <div className="chat-page-fullscreen">
      {/* Chat Window Main Content */}
      <div className="chat-window-main-content fullpage-mode">
        {/* Header */}
        <div className="chat-window-header">
          <div className="header-content-left">
            <div className="chat-window-header-logo">
              <span>M</span>
            </div>
            <div className="header-titles">
              <h2 className="chat-window-title">MOMi</h2>
              <p className="chat-window-subtitle">Your Wellness Assistant</p>
            </div>
          </div>
          <div className="header-content-right">
            <span style={{ color: 'white', fontSize: '0.9em', marginRight: '10px' }}>Hello, {userName}!</span>
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)} 
              className="hamburger-button" 
              aria-label="Open conversations menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Messages List */}
        <div className="message-list">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message-item ${message.sender_type} text`}
            >
              {message.sender_type === 'momi' && (
                <div className="momi-avatar">
                  <span>M</span>
                </div>
              )}
              <div className="message-content">
                {message.image_url && (
                  <img 
                    src={message.image_url} 
                    alt="Shared image" 
                    className="message-image"
                    style={{ maxWidth: '200px', borderRadius: '8px', marginBottom: '8px' }}
                  />
                )}
                <p>{message.content}</p>
              </div>
            </div>
          ))}
          
          {isSending && (
            <div className="message-item momi text">
              <div className="momi-avatar">
                <span>M</span>
              </div>
              <div className="message-content">
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

        {/* Image Preview */}
        {imagePreview && (
          <div className="image-preview-container">
            <img src={imagePreview} alt="Preview" className="image-preview" />
            <button type="button" onClick={removeImage} className="remove-image-btn">×</button>
          </div>
        )}

        {/* Message Input */}
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="message-input-form">
          <div className="input-controls">
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`control-button voice-button ${isSending || isTranscribing ? 'disabled' : ''} ${isRecording ? 'recording' : ''}`}
              disabled={isSending || isTranscribing}
              aria-label={isRecording ? "Stop recording" : "Use voice input"}
            >
              {isRecording ? (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M6 6h12v12H6z"/>
                </svg>
              ) : isTranscribing ? (
                <svg width="22" height="22" viewBox="0 0 120 30" fill="currentColor">
                  <circle cx="15" cy="15" r="15">
                    <animate attributeName="r" from="15" to="15" begin="0s" dur="0.8s" values="15;9;15" calcMode="linear" repeatCount="indefinite" />
                    <animate attributeName="fill-opacity" from="1" to="1" begin="0s" dur="0.8s" values="1;.5;1" calcMode="linear" repeatCount="indefinite" />
                  </circle>
                  <circle cx="60" cy="15" r="9" fillOpacity="0.3">
                    <animate attributeName="r" from="9" to="9" begin="0s" dur="0.8s" values="9;15;9" calcMode="linear" repeatCount="indefinite" />
                    <animate attributeName="fill-opacity" from="0.5" to="0.5" begin="0s" dur="0.8s" values=".5;1;.5" calcMode="linear" repeatCount="indefinite" />
                  </circle>
                  <circle cx="105" cy="15" r="15">
                    <animate attributeName="r" from="15" to="15" begin="0s" dur="0.8s" values="15;9;15" calcMode="linear" repeatCount="indefinite" />
                    <animate attributeName="fill-opacity" from="1" to="1" begin="0s" dur="0.8s" values="1;.5;1" calcMode="linear" repeatCount="indefinite" />
                  </circle>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                </svg>
              )}
            </button>

            <input
              type="file" accept="image/*" onChange={handleImageSelect}
              ref={fileInputRef} style={{display: 'none'}} id="imageUploadInput"
            />
            <label htmlFor="imageUploadInput" className={`control-button image-upload-button ${isSending || isRecording || isTranscribing ? 'disabled' : ''}`} aria-label="Upload image">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
                <circle cx="12" cy="12" r="3.2"/>
              </svg>
            </label>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isRecording ? "Recording..." : (isTranscribing ? "Transcribing..." : "Type your message...")}
              className="text-input"
              disabled={isSending || isRecording || isTranscribing}
              autoComplete="off"
              autoCorrect="on"
              autoCapitalize="sentences"
              spellCheck="true"
              enterKeyHint="send"
            />

            <button type="submit" className="control-button send-button" disabled={isSending || isRecording || isTranscribing || (!inputText.trim() && !selectedImage)}>
              {isSending ? (
                <svg width="22" height="22" viewBox="0 0 120 30" fill="currentColor">
                  <circle cx="15" cy="15" r="15">
                    <animate attributeName="r" from="15" to="15" begin="0s" dur="0.8s" values="15;9;15" calcMode="linear" repeatCount="indefinite" />
                  </circle>
                  <circle cx="60" cy="15" r="9" fillOpacity="0.3">
                    <animate attributeName="r" from="9" to="9" begin="0s" dur="0.8s" values="9;15;9" calcMode="linear" repeatCount="indefinite" />
                  </circle>
                  <circle cx="105" cy="15" r="15">
                    <animate attributeName="r" from="15" to="15" begin="0s" dur="0.8s" values="15;9;15" calcMode="linear" repeatCount="indefinite" />
                  </circle>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="chat-disclaimer">
          <p>MOMi is an AI Chatbot. Information provided is not a substitute for professional medical advice. Always consult with a qualified healthcare provider for any health concerns.</p>
        </div>
      </div>

      {/* Conversations Menu Overlay */}
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
    </div>
  )
}

export default ChatPage