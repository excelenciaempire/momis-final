import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { supabase } from '../supabaseClient';
import './SystemSettingsPage.css'; // We'll create this CSS file next

const SystemSettingsPage = () => {
  const [basePrompt, setBasePrompt] = useState('');
  const [initialPrompt, setInitialPrompt] = useState(''); // To compare for changes
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState('');
  const [error, setError] = useState('');

  const fetchBasePrompt = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setNotification('');
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Not authenticated');

      const response = await axios.get('/api/admin/system-settings/momi-base-prompt', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setBasePrompt(response.data.momi_base_prompt);
      setInitialPrompt(response.data.momi_base_prompt);
    } catch (err) {
      console.error('Error fetching base prompt:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load base prompt.');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchBasePrompt();
  }, [fetchBasePrompt]);

  const handlePromptChange = (e) => {
    setBasePrompt(e.target.value);
    if (error) setError(''); // Clear error when user starts typing
    if (notification) setNotification('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (basePrompt === initialPrompt) {
      setNotification('No changes to save.');
      return;
    }
    setIsSaving(true);
    setError('');
    setNotification('');
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Not authenticated');

      await axios.put('/api/admin/system-settings/momi-base-prompt', 
        { new_prompt_value: basePrompt }, 
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      setInitialPrompt(basePrompt); // Update initial prompt to current saved value
      setNotification('MOMi base prompt updated successfully!');
    } catch (err) {
      console.error('Error updating base prompt:', err);
      setError(err.response?.data?.error || err.message || 'Failed to update base prompt.');
    }
    setIsSaving(false);
  };

  const handleReset = () => {
    setBasePrompt(initialPrompt);
    setError('');
    setNotification('');
  };

  return (
    <div className="system-settings-page">
      <h2>System Settings</h2>
      <form onSubmit={handleSubmit} className="prompt-form">
        <h3>MOMi Base Prompt</h3>
        <p>This prompt guides MOMi's core personality, instructions, and empathetic tone. Edit with care.</p>
        {isLoading ? (
          <p>Loading prompt...</p>
        ) : (
          <textarea
            value={basePrompt}
            onChange={handlePromptChange}
            rows="10"
            placeholder="Enter MOMi's base system prompt here..."
            disabled={isSaving}
          />
        )}
        {error && <p className="error-message settings-error">{error}</p>}
        {notification && <p className="success-message settings-success">{notification}</p>}
        <div className="form-actions">
          <button type="submit" disabled={isSaving || isLoading || basePrompt === initialPrompt} className="save-button">
            {isSaving ? 'Saving...' : 'Save Prompt'}
          </button>
          <button type="button" onClick={handleReset} disabled={isSaving || isLoading || basePrompt === initialPrompt} className="reset-button">
            Reset Changes
          </button>
        </div>
      </form>
      {/* Future settings can be added here */}
    </div>
  );
};

export default SystemSettingsPage; 