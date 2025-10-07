import React, { useState, useEffect, useRef } from 'react'
import { supabase, getCurrentUser } from '../utils/supabaseClient'
import toast from 'react-hot-toast'
import axios from 'axios'

const ChatPage = ({ user, userProfile }) => {
  console.log('ChatPage rendering with:', { user: user?.email, userProfile: userProfile?.first_name });
  
  // Early return for debugging - prevent loading errors
  if (!user) {
    console.log('ChatPage: No user provided');
    return <div>No user found</div>;
  }

  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [conversations, setConversations] = useState([])
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    initializeChat()
  }, [user?.id]) // Only reinitialize when user changes

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Save conversation state to localStorage whenever it changes
  // BUT only save if we have an actual conversation (not just welcome message)
  useEffect(() => {
    if (conversationId && messages.length > 1) { // More than just welcome message
      localStorage.setItem('currentConversationId', conversationId);
      localStorage.setItem('currentMessages', JSON.stringify(messages));
    }
  }, [conversationId, messages])

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const initializeChat = async () => {
    try {
      // Don't reinitialize if we already have messages (preserve current conversation)
      if (messages.length > 0) {
        console.log('Chat already initialized, preserving current conversation');
        return;
      }

      // CHANGE: Start with NEW chat by default instead of loading saved conversation
      // This fixes the issue where users always continue their last conversation
      console.log('Starting fresh chat session for user:', userProfile?.first_name);
      
      // Clear any saved conversation from previous session
      localStorage.removeItem('currentConversationId');
      localStorage.removeItem('currentMessages');
      
      // Get personalized welcome message from backend
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        
        if (token) {
          const response = await axios.get('/api/chat/welcome', {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 5000
          });
          
          if (response.data?.message) {
            const welcomeMessage = {
              id: Date.now(),
              sender_type: 'momi',
              content: response.data.message,
              timestamp: new Date().toISOString()
            };
            setMessages([welcomeMessage]);
            return;
          }
        }
      } catch (apiError) {
        console.warn('Could not get personalized welcome, using fallback:', apiError.message);
      }
      
      // Fallback welcome message
      const userName = userProfile?.first_name || 
                      user?.user_metadata?.first_name || 
                      (user?.email ? user.email.split('@')[0] : null) || 
                      'there';
      
      const welcomeMessage = {
        id: Date.now(),
        sender_type: 'momi',
        content: `Hi ${userName}! 😊 I'm MOMi, your personalized wellness assistant. I'm here to support you with advice based on the 7 Pillars of Wellness. How can I help you today?`,
        timestamp: new Date().toISOString()
      };
      setMessages([welcomeMessage]);
      
    } catch (error) {
      console.error('Error initializing chat:', error);
      // Ultimate fallback
      const welcomeMessage = {
        id: Date.now(),
        sender_type: 'momi',
        content: `Hi there! 😊 I'm MOMi, your personalized wellness assistant. I'm here to support you with advice based on the 7 Pillars of Wellness. How can I help you today?`,
        timestamp: new Date().toISOString()
      };
      setMessages([welcomeMessage]);
    }
  }

  const fetchConversations = async () => {
    if (!user?.id) {
      console.log('No user ID available for fetching conversations');
      return;
    }
    
    try {
      setLoadingConversations(true)
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      if (!token) {
        console.error('No authentication token available')
        return
      }

      console.log('Fetching conversations for user:', user.id);
      const response = await axios.get('/api/chat/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      // Sort conversations by most recent first
      const sortedConversations = response.data.sort((a, b) => 
        new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at)
      )
      
      setConversations(sortedConversations)
      console.log(`Loaded ${sortedConversations.length} conversations`);
    } catch (error) {
      console.error('Error fetching conversations:', error)
      if (error.response?.status === 401) {
        console.log('Session expired, user needs to re-login');
      }
      // Don't show error toast for conversations - it's not critical
    } finally {
      setLoadingConversations(false)
    }
  }

  const sendMessage = async (messageText = inputText, imageFile = selectedImage) => {
    if ((!messageText?.trim() && !imageFile) || isSending) return
    
    if (!isOnline) {
      toast.error('No internet connection. Please check your network and try again.')
      return
    }

    // Create user message
    const userMessage = {
      id: Date.now(),
      sender_type: 'user',
      content: messageText || (imageFile ? '[Image]' : ''),
      timestamp: new Date().toISOString(),
      image: imageFile ? imagePreview : null
    }

    setMessages(prev => [...prev, userMessage])
    setIsSending(true)
    
    // Clear inputs
    setInputText('')
    setSelectedImage(null)
    setImagePreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      
      if (!token) {
        throw new Error('No authentication token available')
      }

      let requestData = {
        message: messageText,
        conversationId: conversationId
      }

      // Handle image upload
      if (imageFile) {
        const formData = new FormData()
        formData.append('image', imageFile)
        formData.append('message', messageText || '')
        formData.append('conversationId', conversationId || '')

        const uploadResponse = await axios.post('/api/chat/upload', formData, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          timeout: 60000 // 60 second timeout for image upload
        })

        requestData.imageUrl = uploadResponse.data.imageUrl
      }

      const response = await axios.post('/api/chat/message', requestData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      })

      const momiMessage = {
        id: Date.now() + 1,
        sender_type: 'momi',
        content: response.data.reply || 'I apologize, but I encountered an issue processing your message. Please try again.',
        timestamp: new Date().toISOString()
      }

      setMessages(prev => [...prev, momiMessage])
      if (response.data.conversationId && !conversationId) {
        setConversationId(response.data.conversationId)
      }

    } catch (error) {
      console.error('Error sending message:', error)
      
      const errorMessage = {
        id: Date.now() + 1,
        sender_type: 'momi',
        content: 'I apologize, but I\'m having trouble responding right now. Please check your connection and try again.',
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
      
      if (error.response?.status === 401) {
        toast.error('Session expired. Please log in again.')
        setTimeout(() => {
          window.location.href = '/login'
        }, 2000)
      } else {
        toast.error('Failed to send message. Please try again.')
      }
    } finally {
      setIsSending(false)
    }
  }

  const startNewConversation = () => {
    // Clear current conversation state
    setMessages([])
    setConversationId(null)
    setIsMenuOpen(false)
    
    // Clear saved state from localStorage
    localStorage.removeItem('currentConversationId');
    localStorage.removeItem('currentMessages');
    
    // Force initialize new chat with welcome message
    const userName = userProfile?.first_name || 
                    user?.user_metadata?.first_name || 
                    (user?.email ? user.email.split('@')[0] : null) || 
                    'there'
    
    const welcomeMessage = {
      id: Date.now(),
      sender_type: 'momi',
      content: `Hi ${userName}! 😊 I'm MOMi, your personalized wellness assistant. I'm here to support you with advice based on the 7 Pillars of Wellness. How can I help you today?`,
      timestamp: new Date().toISOString()
    }
    setMessages([welcomeMessage])
  }

  const loadConversation = async (convId) => {
    try {
      setLoadingConversations(true)
      const token = (await supabase.auth.getSession()).data.session?.access_token
      
      if (!token) {
        toast.error('Session expired. Please log in again.')
        return
      }

      const response = await axios.get(`/api/chat/history/${convId}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      })
      
      // Transform backend message format to frontend format
      const transformedMessages = response.data.map(msg => ({
        id: msg.id,
        sender_type: msg.sender_type,
        content: msg.content,
        timestamp: msg.timestamp
      }))
      
      setMessages(transformedMessages)
      setConversationId(convId)
      setIsMenuOpen(false)
      
      // Update localStorage with loaded conversation
      localStorage.setItem('currentConversationId', convId);
      localStorage.setItem('currentMessages', JSON.stringify(transformedMessages));
      
      toast.success('Conversation loaded successfully')
    } catch (error) {
      console.error('Error loading conversation:', error)
      if (error.response?.status === 401) {
        toast.error('Session expired. Please log in again.')
      } else if (error.code === 'ECONNABORTED') {
        toast.error('Loading conversation timed out. Please try again.')
      } else {
        toast.error('Failed to load conversation. Please try again.')
      }
    } finally {
      setLoadingConversations(false)
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

  // Image handling functions
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error('Image size must be less than 10MB')
        return
      }
      
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onload = (e) => setImagePreview(e.target.result)
      reader.readAsDataURL(file)
      toast.success('Image selected! Add a message or send as is.')
    } else {
      toast.error('Please select a valid image file')
    }
  }

  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Voice recording functions
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Check supported MIME types and use the best available
      let mimeType = 'audio/webm;codecs=opus'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm'
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4'
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/wav'
          }
        }
      }
      
      const recorder = new MediaRecorder(stream, { mimeType })
      const audioChunks = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      recorder.onstop = async () => {
        if (audioChunks.length > 0) {
          const audioBlob = new Blob(audioChunks, { type: mimeType })
          await transcribeAudio(audioBlob)
        } else {
          toast.error('No audio data recorded. Please try again.')
          setIsTranscribing(false)
        }
        stream.getTracks().forEach(track => track.stop())
      }

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error)
        toast.error('Recording error. Please try again.')
        setIsRecording(false)
        setIsTranscribing(false)
        stream.getTracks().forEach(track => track.stop())
      }

      recorder.start()
      setMediaRecorder(recorder)
      setIsRecording(true)
      toast.success('Recording started! Tap again to stop.')
    } catch (error) {
      console.error('Error starting recording:', error)
      if (error.name === 'NotAllowedError') {
        toast.error('Microphone access denied. Please allow microphone permissions and try again.')
      } else if (error.name === 'NotFoundError') {
        toast.error('No microphone found. Please check your audio devices.')
      } else {
        toast.error('Unable to access microphone. Please check permissions and try again.')
      }
    }
  }

  const stopVoiceRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
      setIsRecording(false)
      setIsTranscribing(true)
      toast.info('Processing your voice message...')
    }
  }

  const transcribeAudio = async (audioBlob) => {
    try {
      // Determine file extension based on MIME type
      let fileExtension = 'webm'
      if (audioBlob.type.includes('mp4')) {
        fileExtension = 'mp4'
      } else if (audioBlob.type.includes('wav')) {
        fileExtension = 'wav'
      } else if (audioBlob.type.includes('ogg')) {
        fileExtension = 'ogg'
      }

      const formData = new FormData()
      formData.append('audio', audioBlob, `voice-message.${fileExtension}`)
      
      const token = (await supabase.auth.getSession()).data.session?.access_token
      
      if (!token) {
        throw new Error('Authentication required. Please log in again.')
      }

      console.log('Sending audio for transcription:', {
        size: audioBlob.size,
        type: audioBlob.type,
        filename: `voice-message.${fileExtension}`
      })
      
      const response = await axios.post('/api/chat/speech-to-text', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        timeout: 45000 // Increased timeout for audio processing
      })

      const transcript = response.data.transcript
      if (transcript?.trim()) {
        console.log('Transcription successful:', transcript)
        // Send the transcribed message
        await sendMessage(transcript, selectedImage)
        toast.success('Voice message sent!')
      } else {
        console.warn('Empty transcript received')
        toast.error('Could not understand the audio. Please speak clearly and try again.')
      }
    } catch (error) {
      console.error('Error transcribing audio:', error)
      
      if (error.response) {
        // Server responded with error
        const status = error.response.status
        const message = error.response.data?.error || error.response.data?.details || 'Unknown server error'
        
        if (status === 401) {
          toast.error('Session expired. Please log in again.')
          setTimeout(() => {
            window.location.href = '/login'
          }, 2000)
        } else if (status === 413) {
          toast.error('Audio file too large. Please record a shorter message.')
        } else if (status === 400) {
          toast.error('Invalid audio format. Please try recording again.')
        } else {
          toast.error(`Server error: ${message}`)
        }
      } else if (error.code === 'ECONNABORTED') {
        toast.error('Request timed out. Please try with a shorter recording.')
      } else if (error.message.includes('Authentication required')) {
        toast.error(error.message)
      } else {
        toast.error('Failed to process voice message. Please check your connection and try again.')
      }
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleVoiceClick = () => {
    if (isRecording) {
      stopVoiceRecording()
    } else {
      startVoiceRecording()
    }
  }

  return (
    <div className="chat-page-fullscreen">
      {/* Compact Header */}
      <div className="chat-header-compact">
        <div className="header-left">
          <img src="/momi-icon-2.png" alt="MOMi" className="header-logo" />
          <div className="header-info">
            <h2>MOMi</h2>
            <span>Welcome, {userProfile?.first_name || user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'User'}!</span>
          </div>
        </div>
        <div className="header-right">
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
          <button onClick={startNewConversation} className="new-chat-btn-header">
            New Chat
          </button>
          <button onClick={handleLogout} className="logout-btn-header">
            Logout
          </button>
        </div>
      </div>

      {/* Full-Width Chat Container */}
      <div className="chat-container-fullwidth">
        <div className="messages-area">
          {messages.map((message) => (
            <div key={message.id} className={`message-bubble ${message.sender_type}`}>
              <div className="message-avatar">
                {message.sender_type === 'momi' ? (
                  <img src="/momi-icon-2.png" alt="MOMi" />
                ) : (
                  <div className="user-avatar">{userProfile?.first_name?.[0] || user?.user_metadata?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}</div>
                )}
              </div>
              <div className="message-content">
                {message.image && (
                  <div className="message-image">
                    <img src={message.image} alt="Shared image" className="message-img" />
                  </div>
                )}
                <div className="message-text">{message.content}</div>
                <div className="message-timestamp">
                  {new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            </div>
          ))}
          {isSending && (
            <div className="message-bubble momi">
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

        {/* Image Preview */}
        {imagePreview && (
          <div className="image-preview-container">
            <div className="image-preview-wrapper">
              <img src={imagePreview} alt="Selected" className="image-preview" />
              <button onClick={removeImage} className="remove-image-btn" title="Remove image">
                ×
              </button>
            </div>
            <p className="image-preview-text">Image ready to send</p>
          </div>
        )}

        {/* Full-Width Input Area */}
        <div className="input-area-fullwidth">
          <div className="input-controls">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              ref={fileInputRef}
              style={{ display: 'none' }}
              id="image-upload"
            />
            <label 
              htmlFor="image-upload" 
              className={`attachment-btn ${isSending || isRecording || isTranscribing ? 'disabled' : ''}`} 
              title="Upload Image"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21,15 16,10 5,21"></polyline>
              </svg>
            </label>
            <button 
              className={`voice-btn ${isRecording ? 'recording' : ''} ${isSending || isTranscribing ? 'disabled' : ''}`} 
              onClick={handleVoiceClick}
              disabled={isSending || isTranscribing}
              title={isRecording ? 'Stop recording' : (isTranscribing ? 'Processing...' : 'Voice message')}
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
          </div>
          <div className="input-main">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="message-input-fullwidth"
              rows="1"
              disabled={isSending}
            />
            <button
              onClick={() => sendMessage()}
              disabled={(!inputText.trim() && !selectedImage) || isSending || !isOnline || isRecording || isTranscribing}
              className={`send-btn-fullwidth ${!isOnline ? 'offline' : ''} ${isSending || isRecording || isTranscribing ? 'loading' : ''}`}
              title={
                !isOnline ? 'No internet connection' : 
                isRecording ? 'Recording in progress' :
                isTranscribing ? 'Processing voice message' :
                isSending ? 'Sending...' : 
                'Send message'
              }
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
                      {new Date(conv.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: new Date(conv.created_at).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                      })}
                    </span>
                    <span className="conv-time">
                      {new Date(conv.last_message_at || conv.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <div className="conv-snippet">
                    {conv.summary || conv.last_message || `Conversation started ${new Date(conv.created_at).toLocaleDateString()}`}
                  </div>
                  <div className="conv-message-count">
                    {conv.message_count || 0} messages
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