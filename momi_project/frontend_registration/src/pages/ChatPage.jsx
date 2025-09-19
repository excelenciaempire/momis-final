import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getCurrentUser } from '../utils/supabaseClient'
import toast from 'react-hot-toast'
import axios from 'axios'

const ChatPage = ({ user, userProfile }) => {
  console.log('ChatPage rendering with:', { user: user?.email, userProfile: userProfile?.first_name });
  
  // Early return for debugging
  if (!user) {
    console.log('ChatPage: No user provided');
    return <div>No user found</div>;
  }
  
  // Temporary simple return to test if the error is in the component logic
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>🤖 MOMi Chat</h2>
      <p>Hello {userProfile?.first_name || user?.email?.split('@')[0] || 'User'}!</p>
      <p>Chat interface loading...</p>
    </div>
  );
  
  // Comment out the complex logic temporarily
  /*
  try {
  
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const navigate = useNavigate()
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
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  // Device and browser capability detection
  const capabilities = useMemo(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isAndroid = /Android/.test(navigator.userAgent)
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

    return {
      isMobile,
      isIOS,
      isAndroid,
      isSafari,
      hasMediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      hasFileReader: typeof FileReader !== 'undefined',
      hasIndexedDB: 'indexedDB' in window,
      hasLocalStorage: (() => {
        try {
          localStorage.setItem('test', 'test')
          localStorage.removeItem('test')
          return true
        } catch {
          return false
        }
      })(),
      hasFormData: typeof FormData !== 'undefined',
      hasBlob: typeof Blob !== 'undefined'
    }
  }, [])

  // Memoize user display name for performance
  const userName = useMemo(() => {
    if (userProfile?.first_name) return userProfile.first_name;
    if (user?.user_metadata?.first_name) return user.user_metadata.first_name;
    if (user?.email) return user.email.split('@')[0];
    return 'there';
  }, [userProfile?.first_name, user?.user_metadata?.first_name, user?.email])

  // Don't show loading if we have user data
  const isReady = useMemo(() => {
    return !!(user && userName);
  }, [user, userName]);

  // Memoize conversation list rendering
  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) =>
      new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at)
    )
  }, [conversations])

  useEffect(() => {
    if (isReady) {
      console.log('ChatPage ready, initializing chat for:', userName);
      initializeChat();
    }
  }, [isReady, initializeChat])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Optimize network status listeners
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

  // Cleanup function for component unmount
  useEffect(() => {
    return () => {
      // Clean up any ongoing recordings
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop()
      }
      // Clean up selected image
      if (selectedImage) {
        setSelectedImage(null)
        setImagePreview('')
      }
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  const initializeChat = useCallback(async () => {
    try {
      const welcomeMessage = {
        id: `welcome-${Date.now()}`,
        sender_type: 'momi',
        content: `Hi ${userName}! 😊 I'm MOMi, your personalized wellness assistant. I'm here to support you with advice based on the 7 Pillars of Wellness. How can I help you today?`,
        timestamp: new Date().toISOString()
      }
      setMessages([welcomeMessage])
    } catch (error) {
      console.error('Error initializing chat:', error)
      // Fallback welcome message
      const welcomeMessage = {
        id: `welcome-fallback-${Date.now()}`,
        sender_type: 'momi',
        content: `Hi there! 😊 I'm MOMi, your personalized wellness assistant. I'm here to support you with advice based on the 7 Pillars of Wellness. How can I help you today?`,
        timestamp: new Date().toISOString()
      }
      setMessages([welcomeMessage])
    }
  }, [userName])

  const fetchConversations = async () => {
    if (!user?.id) return
    
    try {
      // No loading state - fetch in background for better UX
      const token = (await supabase.auth.getSession()).data.session?.access_token
      
      if (!token) {
        console.error('No authentication token available')
        return
      }

      const response = await axios.get('/api/chat/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      // Sort conversations by most recent first
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
        try {
          const formData = new FormData()
          formData.append('image', imageFile)
          formData.append('message', messageText || '')
          formData.append('conversationId', conversationId || '')
          formData.append('userId', user.id) // Add user ID for better tracking

          const uploadResponse = await axios.post('/api/chat/upload', formData, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            },
            timeout: 60000, // 60 second timeout for image upload
            maxContentLength: 10 * 1024 * 1024, // 10MB limit
            maxBodyLength: 10 * 1024 * 1024 // 10MB limit
          })

          if (!uploadResponse.data?.imageUrl) {
            throw new Error('Invalid response from image upload service')
          }

          requestData.imageUrl = uploadResponse.data.imageUrl
        } catch (uploadError) {
          console.error('Image upload failed:', uploadError)

          // Remove the image message from UI
          setMessages(prev => prev.slice(0, -1))

          if (uploadError.code === 'ECONNABORTED') {
            toast.error('Image upload timed out. Please try with a smaller image.')
          } else if (uploadError.response?.status === 413) {
            toast.error('Image is too large. Please use an image smaller than 10MB.')
          } else if (uploadError.response?.status === 401) {
            toast.error('Session expired. Please log in again.')
            setTimeout(() => navigate('/login'), 2000)
          } else {
            toast.error('Failed to upload image. Please try again.')
          }

          setIsSending(false)
          return
        }
      }

      // Add user context to request for better tracking
      requestData.userId = user.id
      requestData.userEmail = user.email

      const response = await axios.post('/api/chat/message', requestData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-User-ID': user.id, // Additional header for backend tracking
        },
        timeout: 30000
      })

      // Validate response
      if (!response.data || typeof response.data.reply !== 'string') {
        throw new Error('Invalid response from chat service')
      }

      const momiMessage = {
        id: response.data.messageId || `${Date.now()}-${Math.random()}`,
        sender_type: 'momi',
        content: response.data.reply,
        timestamp: response.data.timestamp || new Date().toISOString(),
        conversationId: response.data.conversationId
      }

      setMessages(prev => [...prev, momiMessage])

      // Update conversation ID if provided
      if (response.data.conversationId && !conversationId) {
        setConversationId(response.data.conversationId)
      }

    } catch (error) {
      console.error('Error sending message:', error)

      // Remove the user message from UI if sending failed
      setMessages(prev => prev.slice(0, -1))

      let errorMessage = 'I apologize, but I\'m having trouble responding right now. Please try again.'
      let shouldRetry = false

      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. Please check your connection and try again.'
        toast.error('Message timed out. Please try again.')
      } else if (error.response?.status === 401) {
        errorMessage = 'Your session has expired. Please log in again.'
        toast.error('Session expired. Please log in again.')
        setTimeout(() => navigate('/login'), 2000)
      } else if (error.response?.status === 403) {
        errorMessage = 'Access denied. Please check your permissions.'
        toast.error('Access denied. Please log in again.')
        setTimeout(() => navigate('/login'), 2000)
      } else if (error.response?.status === 429) {
        errorMessage = 'Too many requests. Please wait a moment before sending another message.'
        toast.error('Please wait a moment before sending another message.')
      } else if (error.response?.status >= 500) {
        errorMessage = 'Our servers are temporarily unavailable. Please try again in a moment.'
        toast.error('Server temporarily unavailable. Please try again.')
        shouldRetry = true
      } else if (!navigator.onLine) {
        errorMessage = 'You appear to be offline. Please check your internet connection.'
        toast.error('You appear to be offline. Please check your connection.')
        shouldRetry = true
      } else {
        toast.error('Failed to send message. Please try again.')
        shouldRetry = true
      }

      // Add error message to chat
      const errorMsgObj = {
        id: `error-${Date.now()}-${Math.random()}`,
        sender_type: 'momi',
        content: errorMessage,
        timestamp: new Date().toISOString(),
        isError: true
      }
      setMessages(prev => [...prev, errorMsgObj])

      // Auto-retry for certain errors after a delay
      if (shouldRetry && messageText) {
        setTimeout(() => {
          if (navigator.onLine) {
            console.log('Auto-retrying message send...')
            // Don't auto-retry to avoid infinite loops
          }
        }, 5000)
      }
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
        // Use React Router navigation instead of window.location
        navigate('/login', { replace: true })
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
  const handleImageUpload = useCallback((e) => {
    const file = e.target.files?.[0]

    if (!file) return

    // Check browser capabilities
    if (!capabilities.hasFileReader) {
      toast.error('Image upload is not supported in your browser')
      return
    }

    if (!capabilities.hasFormData || !capabilities.hasBlob) {
      toast.error('File upload is not supported in your browser')
      return
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error('Please select a valid image file (JPEG, PNG, GIF, or WebP)')
      return
    }

    // Dynamic file size limit based on device
    const maxSize = capabilities.isMobile ? 5 * 1024 * 1024 : 10 * 1024 * 1024 // 5MB for mobile, 10MB for desktop
    if (file.size > maxSize) {
      const sizeText = capabilities.isMobile ? '5MB' : '10MB'
      toast.error(`Image size must be less than ${sizeText}`)
      return
    }

    // Validate user authentication
    if (!user?.id) {
      toast.error('Please log in to upload images')
      return
    }

    setSelectedImage(file)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        setImagePreview(e.target.result)
        toast.success('Image selected! Add a message or send as is.')
      } catch (error) {
        console.error('Error reading image file:', error)
        toast.error('Error reading image file. Please try another image.')
        setSelectedImage(null)
        setImagePreview('')
      }
    }

    reader.onerror = () => {
      toast.error('Error reading image file. Please try another image.')
      setSelectedImage(null)
      setImagePreview('')
    }

    reader.readAsDataURL(file)
  }, [capabilities, user?.id])

  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Voice recording functions
  const startVoiceRecording = async () => {
    try {
      // Check user authentication
      if (!user?.id) {
        toast.error('Please log in to use voice messages')
        return
      }

      // Check browser capabilities
      if (!capabilities.hasMediaDevices) {
        toast.error('Voice recording is not supported in your browser')
        return
      }

      if (!capabilities.hasBlob) {
        toast.error('Voice recording requires modern browser features not available')
        return
      }

      // Request microphone access with device-specific constraints
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        // Lower sample rate for mobile devices to reduce bandwidth
        sampleRate: capabilities.isMobile ? 22050 : 44100
      }

      // iOS specific adjustments
      if (capabilities.isIOS) {
        audioConstraints.channelCount = 1 // Mono for better iOS compatibility
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints
      })

      // Check MediaRecorder support
      const options = { mimeType: 'audio/webm' }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/ogg'
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options.mimeType = 'audio/wav'
          if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            toast.error('Audio recording is not supported in your browser')
            stream.getTracks().forEach(track => track.stop())
            return
          }
        }
      }

      const recorder = new MediaRecorder(stream, options)
      const audioChunks = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      recorder.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunks, { type: options.mimeType })

          // Validate audio blob
          if (audioBlob.size === 0) {
            toast.error('No audio was recorded. Please try again.')
            return
          }

          if (audioBlob.size > 25 * 1024 * 1024) { // 25MB limit
            toast.error('Audio recording is too long. Please keep it under 5 minutes.')
            return
          }

          await transcribeAudio(audioBlob)
        } catch (error) {
          console.error('Error processing audio:', error)
          toast.error('Error processing audio recording. Please try again.')
        } finally {
          stream.getTracks().forEach(track => track.stop())
        }
      }

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error)
        toast.error('Recording error occurred. Please try again.')
        stream.getTracks().forEach(track => track.stop())
        setIsRecording(false)
        setMediaRecorder(null)
      }

      recorder.start(1000) // Collect data every second
      setMediaRecorder(recorder)
      setIsRecording(true)
      toast.success('Recording started! Tap again to stop.')

    } catch (error) {
      console.error('Error starting recording:', error)

      if (error.name === 'NotAllowedError') {
        toast.error('Microphone access denied. Please allow microphone access and try again.')
      } else if (error.name === 'NotFoundError') {
        toast.error('No microphone found. Please connect a microphone and try again.')
      } else if (error.name === 'NotSupportedError') {
        toast.error('Audio recording is not supported in your browser.')
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
      const token = (await supabase.auth.getSession()).data.session?.access_token

      if (!token) {
        toast.error('Session expired. Please log in again.')
        setTimeout(() => navigate('/login'), 2000)
        return
      }

      const formData = new FormData()
      // Use appropriate filename based on blob type
      const fileExtension = audioBlob.type.includes('webm') ? '.webm' :
                          audioBlob.type.includes('ogg') ? '.ogg' : '.wav'
      formData.append('audio', audioBlob, `voice-message-${Date.now()}${fileExtension}`)
      formData.append('userId', user.id) // Add user ID for tracking

      const response = await axios.post('/api/chat/speech-to-text', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        timeout: 45000, // Increased timeout for audio processing
        maxContentLength: 25 * 1024 * 1024, // 25MB limit
        maxBodyLength: 25 * 1024 * 1024 // 25MB limit
      })

      const transcript = response.data?.transcript?.trim()

      if (transcript) {
        // Send the transcribed message
        await sendMessage(transcript, selectedImage)
        toast.success('Voice message sent!')
      } else {
        toast.error('Could not understand the audio. Please speak clearly and try again.')
      }
    } catch (error) {
      console.error('Error transcribing audio:', error)

      if (error.code === 'ECONNABORTED') {
        toast.error('Audio processing timed out. Please try with a shorter recording.')
      } else if (error.response?.status === 413) {
        toast.error('Audio file is too large. Please record a shorter message.')
      } else if (error.response?.status === 401) {
        toast.error('Session expired. Please log in again.')
        setTimeout(() => navigate('/login'), 2000)
      } else if (error.response?.status === 422) {
        toast.error('Audio format not supported. Please try again.')
      } else if (error.response?.status === 429) {
        toast.error('Too many requests. Please wait a moment and try again.')
      } else {
        toast.error('Failed to process voice message. Please try again.')
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

  // ChatPage should always render if we reach here (user exists)

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
              {conversations.length === 0 && (
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
  
  } catch (error) {
    console.error('ChatPage render error:', error);
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Chat Loading Error</h2>
        <p>There was an error loading the chat interface.</p>
        <p>Error: {error.message}</p>
        <button onClick={() => window.location.reload()}>Reload Page</button>
      </div>
    );
  }
  */
}

export default ChatPage