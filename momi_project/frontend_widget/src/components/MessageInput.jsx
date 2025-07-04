import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './MessageInput.css';

// SVG Icon Components
const CameraIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
    <path d="M20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
    <circle cx="12" cy="12" r="3.2"/>
  </svg>
);

const MicIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
  </svg>
);

const StopIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
    <path d="M6 6h12v12H6z"/>
  </svg>
);

const LoadingDotsIcon = () => (
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
);

const MessageInput = ({ onSendMessage, isLoading, messages = [] }) => {
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const fileInputRef = useRef(null);
  const audioChunksRef = useRef([]);
  const inputRef = useRef(null); // Add ref for text input

  // Voice input state
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [voiceError, setVoiceError] = useState('');
  const [transcribing, setTranscribing] = useState(false);

  // Auto-focus input when messages change
  useEffect(() => {
    // Only focus if not recording or transcribing to avoid interrupting voice input
    if (!isRecording && !transcribing && inputRef.current) {
      // Small delay to ensure DOM is updated after message render
      setTimeout(() => {
        // Check if device is not mobile or if user has interacted recently
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // On mobile devices, only auto-focus if the keyboard was already visible
        // This prevents unwanted keyboard popup
        if (!isMobile || document.activeElement === inputRef.current || document.activeElement?.tagName === 'INPUT') {
          inputRef.current?.focus();
          
          // Prevent zoom on iOS devices by temporarily setting font-size
          if (isMobile && inputRef.current) {
            const currentFontSize = window.getComputedStyle(inputRef.current).fontSize;
            inputRef.current.style.fontSize = '16px';
            setTimeout(() => {
              if (inputRef.current) {
                inputRef.current.style.fontSize = currentFontSize;
              }
            }, 300);
          }
        }
      }, 100);
    }
  }, [messages.length, isRecording, transcribing]);

  // Focus on mount for desktop
  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile && inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    // Clean up MediaRecorder effects
    return () => {
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      }
    };
  }, [mediaRecorder]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((!text.trim() && !imageFile) || isLoading || transcribing) return;
    onSendMessage(text, imageFile);
    setText('');
    setImageFile(null);
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  // --- Voice Input Handlers ---
  const startRecording = async () => {
    setVoiceError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setVoiceError('MediaDevices API not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);
      recorder.ondataavailable = (event) => {
        console.log('ondataavailable event fired, data size:', event.data.size);
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = async () => {
        console.log('onstop event fired, current audioChunks from ref:', audioChunksRef.current);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log('Created audioBlob, size:', audioBlob.size);
        audioChunksRef.current = [];
        stream.getTracks().forEach(track => track.stop());
        if (audioBlob.size === 0) {
            setVoiceError("Recording was empty. Please try again.");
            setTranscribing(false);
            return;
        }
        await transcribeAudio(audioBlob);
      };
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setVoiceError(`Mic access denied or error: ${err.message}. Check browser permissions.`);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      setIsRecording(false);
      setTranscribing(true); // Indicate transcription is in progress
    }
  };

  const transcribeAudio = async (audioBlob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'user_audio.webm'); 
    try {
      const response = await axios.post('/api/chat/speech-to-text', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const transcript = response.data.transcript;
      setVoiceError('');
      
      // Automatically send the message with the transcript
      // Pass current imageFile if one was selected before starting voice input (edge case)
      onSendMessage(transcript, imageFile); 
      setText(''); // Clear text input after sending
      if (imageFile) { // If an image was part of this auto-send, clear it too
        setImageFile(null);
        setImagePreview('');
        if (fileInputRef.current) fileInputRef.current.value = null;
      }

    } catch (err) {
      console.error('Error transcribing audio:', err);
      setVoiceError(`Transcription failed: ${err.response?.data?.details || err.message}`);
    }
    setTranscribing(false);
  };

  const handleVoiceInputClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="message-input-form">
      {voiceError && <p className="voice-error-message">{voiceError}</p>}
      {imagePreview && (
        <div className="image-preview-container">
          <img src={imagePreview} alt="Preview" className="image-preview" />
          <button type="button" onClick={removeImage} className="remove-image-btn">×</button>
        </div>
      )}
      <div className="input-controls">
        <button
          type="button"
          onClick={handleVoiceInputClick}
          className={`control-button voice-button ${isLoading || transcribing ? 'disabled' : ''} ${isRecording ? 'recording' : ''}`}
          disabled={isLoading || transcribing}
          aria-label={isRecording ? "Stop recording" : "Use voice input"}
        >
          {isRecording ? <StopIcon /> : (transcribing ? <LoadingDotsIcon /> : <MicIcon />)}
        </button>

        <input
          type="file" accept="image/*" onChange={handleImageChange}
          ref={fileInputRef} style={{display: 'none'}} id="imageUploadInput"
        />
        <label htmlFor="imageUploadInput" className={`control-button image-upload-button ${isLoading || isRecording || transcribing ? 'disabled' : ''}`} aria-label="Upload image">
          <CameraIcon />
        </label>

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isRecording ? "Recording..." : (transcribing ? "Transcribing..." : "Type your message...")}
          className="text-input"
          disabled={isLoading || isRecording || transcribing}
          ref={inputRef}
          autoComplete="off"
          autoCorrect="on"
          autoCapitalize="sentences"
          spellCheck="true"
          enterKeyHint="send"
        />

        <button type="submit" className="control-button send-button" disabled={isLoading || isRecording || transcribing || (!text.trim() && !imageFile)}>
          {isLoading ? <LoadingDotsIcon /> : <SendIcon />}
        </button>
      </div>
    </form>
  );
};

export default MessageInput; 