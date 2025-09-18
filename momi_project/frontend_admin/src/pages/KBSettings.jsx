import React, { useState, useEffect } from 'react';
import apiClient from '../apiClient';
import './KBSettings.css';

const KBSettings = () => {
  const [config, setConfig] = useState({
    similarity_threshold: 0.78,
    max_chunks: 5,
    use_top_chunks: 3,
    debug_mode: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError('');
      // Try to get KB config, fallback to defaults if not found
      const response = await apiClient.get('/admin/system-settings/kb-config');
      setConfig(response.data.config || config);
    } catch (err) {
      // Use default config if endpoint doesn't exist
      setError('');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      await apiClient.put('/admin/system-settings/kb-config', {
        config: config
      });
      
      setSuccess('KB settings updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update KB settings.');
    } finally {
      setSaving(false);
    }
  };

  const testKB = async () => {
    if (!testQuery.trim()) {
      alert('Please enter a test query.');
      return;
    }

    try {
      setTesting(true);
      const response = await apiClient.post('/admin/kb/test-query', {
        query: testQuery
      });
      setTestResults(response.data);
    } catch (err) {
      alert('Test failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setTesting(false);
    }
  };

  const runHealthCheck = async () => {
    try {
      const response = await apiClient.get('/admin/kb/health-check');
      alert(`KB Health Status: ${response.data.status}\n\nDetails:\n${JSON.stringify(response.data.checks, null, 2)}`);
    } catch (err) {
      alert('Health check failed: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div>
      <h1 className="page-header">Knowledge Base Settings</h1>
      
      <div className="kb-settings-container">
        <div className="settings-section">
          <h3>RAG Configuration</h3>
          
          {loading && <p>Loading settings...</p>}
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          {!loading && (
            <form onSubmit={saveConfig} className="settings-form">
              <div className="form-group">
                <label htmlFor="similarity">Similarity Threshold</label>
                <input
                  type="number"
                  id="similarity"
                  min="0.1"
                  max="1.0"
                  step="0.01"
                  value={config.similarity_threshold}
                  onChange={(e) => setConfig({...config, similarity_threshold: parseFloat(e.target.value)})}
                />
                <small>How similar content must be to include in responses (0.1-1.0)</small>
              </div>

              <div className="form-group">
                <label htmlFor="maxChunks">Max Chunks to Retrieve</label>
                <input
                  type="number"
                  id="maxChunks"
                  min="1"
                  max="20"
                  value={config.max_chunks}
                  onChange={(e) => setConfig({...config, max_chunks: parseInt(e.target.value)})}
                />
                <small>Maximum number of document chunks to search through</small>
              </div>

              <div className="form-group">
                <label htmlFor="topChunks">Top Chunks to Use</label>
                <input
                  type="number"
                  id="topChunks"
                  min="1"
                  max="10"
                  value={config.use_top_chunks}
                  onChange={(e) => setConfig({...config, use_top_chunks: parseInt(e.target.value)})}
                />
                <small>Number of best-matching chunks to include in AI response</small>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={config.debug_mode}
                    onChange={(e) => setConfig({...config, debug_mode: e.target.checked})}
                  />
                  Enable Debug Mode
                </label>
                <small>Show detailed KB retrieval logs in server console</small>
              </div>

              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          )}
        </div>

        <div className="test-section">
          <h3>Test Knowledge Base</h3>
          <div className="test-form">
            <div className="form-group">
              <label htmlFor="testQuery">Test Query</label>
              <input
                type="text"
                id="testQuery"
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                placeholder="Enter a question to test KB retrieval..."
              />
            </div>
            <div className="test-actions">
              <button onClick={testKB} disabled={testing} className="btn-secondary">
                {testing ? 'Testing...' : 'Test Query'}
              </button>
              <button onClick={runHealthCheck} className="btn-secondary">
                Health Check
              </button>
            </div>
          </div>

          {testResults && (
            <div className="test-results">
              <h4>Test Results</h4>
              <p><strong>Query:</strong> {testResults.query}</p>
              <p><strong>Chunks Found:</strong> {testResults.chunks_found}</p>
              <p><strong>Search Time:</strong> {testResults.total_time_ms}ms</p>
              
              {testResults.results && testResults.results.length > 0 && (
                <div className="results-list">
                  <h5>Matching Documents:</h5>
                  {testResults.results.map((result, idx) => (
                    <div key={idx} className="result-item">
                      <strong>{result.document}</strong> (Similarity: {result.similarity.toFixed(3)})
                      <p>{result.text_preview}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KBSettings;
