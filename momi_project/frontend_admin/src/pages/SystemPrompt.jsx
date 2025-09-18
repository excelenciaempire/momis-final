import React, { useState, useEffect } from 'react';
import apiClient from '../apiClient';
import './SystemPrompt.css';

const SystemPrompt = () => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchPrompt();
  }, []);

  const fetchPrompt = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiClient.get('/admin/system-settings/momi-base-prompt');
      setPrompt(response.data.momi_base_prompt || '');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch system prompt.');
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

  return (
    <div>
      <h1 className="page-header">System Prompt Configuration</h1>
      
      <div className="prompt-section">
        <div className="prompt-info">
          <h3>MOMi's Base Personality</h3>
          <p>This prompt defines how MOMi behaves and responds to users. Changes take effect immediately for new conversations.</p>
        </div>

        {loading && <p>Loading current prompt...</p>}
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {!loading && (
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
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default SystemPrompt;
