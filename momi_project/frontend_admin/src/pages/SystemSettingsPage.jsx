import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { supabase } from '../supabaseClient';
import './SystemSettingsPage.css'; // We'll create this CSS file next

const SystemSettingsPage = () => {
  const [basePrompt, setBasePrompt] = useState('');
  const [initialPrompt, setInitialPrompt] = useState('');
  const [openingMessage, setOpeningMessage] = useState('');
  const [initialOpeningMessage, setInitialOpeningMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState({ type: '', message: '' });

  // Helper to get token, lenient for preview
  const getToken = async () => {
    const sessionData = await supabase.auth.getSession();
    const session = sessionData?.data?.session;
    if (session) {
      return session.access_token;
    }
    console.warn("SystemSettingsPage: No active session, proceeding for preview. API calls may fail if auth is enforced by backend.");
    return null; // Return null if no session
  };

  const fetchBasePrompt = useCallback(async () => {
    setIsLoading(true);
    setNotification({ type: '', message: '' });
    let token = null;
    try {
      token = await getToken();
      // if (!token) throw new Error('Not authenticated. Please log in.'); // Allow proceeding for preview

      const response = await axios.get('/api/admin/system-settings/momi-base-prompt', {
        headers: { ...(token && { Authorization: `Bearer ${token}` }) }, // Conditionally add auth header
      });
      setBasePrompt(response.data.momi_base_prompt);
      setInitialPrompt(response.data.momi_base_prompt);

      // Fetch opening message
      const openingMessageResponse = await axios.get('/api/admin/system-settings/opening-message', {
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      });
      setOpeningMessage(openingMessageResponse.data.opening_message);
      setInitialOpeningMessage(openingMessageResponse.data.opening_message);
    } catch (err) {
      console.error('Error fetching base prompt:', err);
      let errMsg = err.response?.data?.error || err.message || 'Failed to load base prompt.';
      if (!token && err.response?.status === 401) {
        errMsg = "Failed to load prompt: Authentication error. Backend may require login.";
      }
      setNotification({ type: 'error', message: errMsg});
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchBasePrompt();
  }, [fetchBasePrompt]);

  const handlePromptChange = (e) => {
    setBasePrompt(e.target.value);
    if (notification.message) setNotification({ type: '', message: '' }); // Clear notification when user starts typing
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (basePrompt === initialPrompt && openingMessage === initialOpeningMessage) {
      setNotification({ type: 'info', message: 'No changes to save.'});
      return;
    }
    setIsSaving(true);
    setNotification({ type: '', message: '' });
    let token = null;
    try {
      token = await getToken();

      if (basePrompt !== initialPrompt) {
        await axios.put('/api/admin/system-settings/momi-base-prompt', 
          { new_prompt_value: basePrompt }, 
          { headers: { ...(token && { Authorization: `Bearer ${token}` }) } }
        );
        setInitialPrompt(basePrompt); 
      }

      if (openingMessage !== initialOpeningMessage) {
        await axios.put('/api/admin/system-settings/opening-message', 
          { new_message_value: openingMessage }, 
          { headers: { ...(token && { Authorization: `Bearer ${token}` }) } }
        );
        setInitialOpeningMessage(openingMessage);
      }

      setNotification({ type: 'success', message: 'Settings updated successfully!'});
    } catch (err) {
      console.error('Error updating base prompt:', err);
      let errMsg = err.response?.data?.error || err.message || 'Failed to update base prompt.';
      if (!token && err.response?.status === 401) {
        errMsg = "Failed to save prompt: Authentication error. Backend may require login.";
      }
      setNotification({ type: 'error', message: errMsg});
    }
    setIsSaving(false);
  };

  const handleReset = () => {
    setBasePrompt(initialPrompt);
    setNotification({ type: '', message: '' });
  };

  const hasChanges = basePrompt !== initialPrompt;

  return (
    <div className="system-settings-container"> {/* Consistent container name */}
      <h1 className="page-header">System Settings</h1>

      {notification.message && (
        <div className={`${notification.type === 'info' ? 'info' : notification.type === 'success' ? 'success' : 'error'}-message`}>
          {notification.message}
        </div>
      )}

      <div className="card">
        <div className="card-header">MOMi Opening Message</div>
        <form onSubmit={handleSubmit} style={{ paddingTop: '15px' }}>
          <p style={{ marginTop: 0, marginBottom: '15px', fontSize: '0.9em' }}>
            This is the first message a user sees when they open the chat.
          </p>
          {isLoading ? (
            <div className="loading-prompt-placeholder">
              <p>Loading message...</p>
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="openingMessage" style={{ display: 'none' }}>Opening Message</label>
              <textarea
                id="openingMessage"
                value={openingMessage}
                onChange={(e) => setOpeningMessage(e.target.value)}
                rows="4"
                placeholder="Enter the opening message..."
                disabled={isSaving}
                className="base-prompt-textarea"
              />
            </div>
          )}
        </form>
      </div>

      <div className="card"> {/* Wrap form in a card */}
        <div className="card-header">MOMi Base System Prompt</div>
        <form onSubmit={handleSubmit} style={{ paddingTop: '15px' }}>
          <p style={{ marginTop: 0, marginBottom: '15px', fontSize: '0.9em' }}>
            This prompt guides MOMi's core personality, instructions, and empathetic tone. Edit with care.
          </p>
          {isLoading ? (
            <div className="loading-prompt-placeholder">
                <p>Loading prompt...</p>
                <div className="spinner"></div> {/* Optional: Add a CSS spinner */}
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="momiBasePrompt" style={{ display: 'none' }}>MOMi Base Prompt</label> {/* Hidden label for accessibility */}
              <textarea
                id="momiBasePrompt"
                value={basePrompt}
                onChange={handlePromptChange}
                rows="15" /* Increased rows */
                placeholder="Enter MOMi's base system prompt here..."
                disabled={isSaving}
                className="base-prompt-textarea"
              />
            </div>
          )}
          
          <div className="form-actions">
            <button type="submit" disabled={isSaving || isLoading || !hasChanges} className="button">
              {isSaving ? 'Saving...' : 'Save All Settings'}
            </button>
            <button type="button" onClick={handleReset} disabled={isSaving || isLoading || !hasChanges} className="button secondary">
              Reset Changes
            </button>
          </div>
        </form>
      </div>
      {/* Future settings could be additional cards */}
    </div>
  );
};

export default SystemSettingsPage; 