import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { supabase } from '../supabaseClient';
import './SystemSettingsPage.css'; // We'll create this CSS file next

const SystemSettingsPage = () => {
  const [basePrompt, setBasePrompt] = useState('');
  const [initialPrompt, setInitialPrompt] = useState(''); // To compare for changes
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState({ type: '', message: '' }); // type: 'success', 'info', or 'error'

  const fetchBasePrompt = useCallback(async () => {
    setIsLoading(true);
    setNotification({ type: '', message: '' });
    try {
      const sessionData = await supabase.auth.getSession();
      const session = sessionData?.data?.session;
      if (!session) throw new Error('Not authenticated. Please log in.');

      const response = await axios.get('/api/admin/system-settings/momi-base-prompt', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setBasePrompt(response.data.momi_base_prompt);
      setInitialPrompt(response.data.momi_base_prompt);
    } catch (err) {
      console.error('Error fetching base prompt:', err);
      setNotification({ type: 'error', message: err.response?.data?.error || err.message || 'Failed to load base prompt.'});
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
    if (basePrompt === initialPrompt) {
      setNotification({ type: 'info', message: 'No changes to save.'});
      return;
    }
    setIsSaving(true);
    setNotification({ type: '', message: '' });
    try {
      const sessionData = await supabase.auth.getSession();
      const session = sessionData?.data?.session;
      if (!session) throw new Error('Not authenticated. Please log in.');

      await axios.put('/api/admin/system-settings/momi-base-prompt', 
        { new_prompt_value: basePrompt }, 
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      setInitialPrompt(basePrompt); 
      setNotification({ type: 'success', message: 'MOMi base prompt updated successfully!'});
    } catch (err) {
      console.error('Error updating base prompt:', err);
      setNotification({ type: 'error', message: err.response?.data?.error || err.message || 'Failed to update base prompt.'});
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
              {isSaving ? 'Saving...' : 'Save Prompt'}
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