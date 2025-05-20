import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './MessageInput.css';

const MessageInput = ({ onSendMessage, isLoading }) => {
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const fileInputRef = useRef(null);

  // Voice input state
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [voiceError, setVoiceError] = useState('');
  const [transcribing, setTranscribing] = useState(false);

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
        setAudioChunks((prev) => [...prev, event.data]);
      };
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); // or 'audio/mp4' if preferred and supported
        setAudioChunks([]);
        stream.getTracks().forEach(track => track.stop()); // Stop microphone access indication
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
    // Whisper API expects a filename. The actual name doesn't matter much as long as it has an extension.
    formData.append('audio', audioBlob, 'user_audio.webm'); 
    try {
      const response = await axios.post('/api/chat/speech-to-text', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setText(prevText => prevText + (prevText ? ' ' : '') + response.data.transcript); // Append transcript
      setVoiceError('');
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
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isRecording ? "Recording... Speak now!" : (transcribing ? "Transcribing..." : "Type message or use mic...")}
          className="text-input"
          disabled={isLoading || isRecording || transcribing}
        />
        <input 
          type="file" accept="image/*" onChange={handleImageChange}
          ref={fileInputRef} style={{display: 'none'}} id="imageUploadInput"
        />
        <label htmlFor="imageUploadInput" className={`control-button image-upload-button ${isLoading || isRecording || transcribing ? 'disabled' : ''}`} aria-label="Upload image">
          🖼️
        </label>
        <button 
          type="button" 
          onClick={handleVoiceInputClick} 
          className={`control-button voice-button ${isLoading || transcribing ? 'disabled' : ''} ${isRecording ? 'recording' : ''}`}
          disabled={isLoading || transcribing}
          aria-label={isRecording ? "Stop recording" : "Use voice input"}
        >
          {isRecording ? '🛑' : (transcribing ? '⏳' : '🎤')}
        </button>
        <button type="submit" className="control-button send-button" disabled={isLoading || isRecording || transcribing || (!text.trim() && !imageFile)}>
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </form>
  );
};

export default MessageInput; 