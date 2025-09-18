import React, { useState, useEffect } from 'react';
import apiClient from '../apiClient';
import './SystemPrompt.css';

const SystemPrompt = () => {
  const [prompt, setPrompt] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('prompt');

  useEffect(() => {
    fetchPrompt();
  }, []);

  const fetchPrompt = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch system prompt
      const promptResponse = await apiClient.get('/admin/system-settings/momi-base-prompt');
      setPrompt(promptResponse.data.momi_base_prompt || '');
      
      // Fetch welcome message
      try {
        const welcomeResponse = await apiClient.get('/admin/system-settings/opening-message');
        setWelcomeMessage(welcomeResponse.data.opening_message || '');
      } catch (welcomeErr) {
        console.log('Welcome message not found, using empty default');
        setWelcomeMessage('');
      }
      
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch system settings.');
    } finally {
      setLoading(false);
    }
  };

  const savePrompt = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) {
      alert('Prompt cannot be empty.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      await apiClient.put('/admin/system-settings/momi-base-prompt', {
        new_prompt_value: prompt
      });
      
      setSuccess('System prompt updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update system prompt.');
    } finally {
      setSaving(false);
    }
  };

  const saveWelcomeMessage = async (e) => {
    e.preventDefault();
    if (!welcomeMessage.trim()) {
      alert('Welcome message cannot be empty.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      await apiClient.put('/admin/system-settings/opening-message', {
        new_message_value: welcomeMessage
      });
      
      setSuccess('Welcome message updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update welcome message.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="page-header">🤖 MOMi Configuration</h1>
      
      <div className="tabs-container">
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'prompt' ? 'active' : ''}`}
            onClick={() => setActiveTab('prompt')}
          >
            System Prompt
          </button>
          <button 
            className={`tab ${activeTab === 'welcome' ? 'active' : ''}`}
            onClick={() => setActiveTab('welcome')}
          >
            Welcome Message
          </button>
        </div>

        {loading && <p>Loading settings...</p>}
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {!loading && activeTab === 'prompt' && (
          <div className="prompt-section">
            <div className="prompt-info">
              <h3>🧠 MOMi's Base Personality</h3>
              <p>This prompt defines how MOMi behaves and responds to users. Changes take effect immediately for new conversations.</p>
            </div>

            <form onSubmit={savePrompt} className="prompt-form">
              <div className="form-group">
                <label htmlFor="prompt">System Prompt</label>
                <textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="prompt-textarea"
                  rows="15"
                  placeholder="Enter MOMi's system prompt here..."
                />
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={fetchPrompt}
                  className="btn-secondary"
                  disabled={saving}
                >
                  Reset to Current
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save System Prompt'}
                </button>
              </div>
            </form>
          </div>
        )}

        {!loading && activeTab === 'welcome' && (
          <div className="prompt-section">
            <div className="prompt-info">
              <h3>👋 Welcome Message</h3>
              <p>This is the first message users see when they start a new conversation with MOMi.</p>
            </div>

            <form onSubmit={saveWelcomeMessage} className="prompt-form">
              <div className="form-group">
                <label htmlFor="welcomeMessage">Welcome Message</label>
                <textarea
                  id="welcomeMessage"
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  className="prompt-textarea"
                  rows="8"
                  placeholder="Enter the welcome message users see when starting a chat..."
                />
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={fetchPrompt}
                  className="btn-secondary"
                  disabled={saving}
                >
                  Reset to Current
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Welcome Message'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemPrompt;
