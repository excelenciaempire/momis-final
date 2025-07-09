import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../supabaseClient';
import './KnowledgeBaseSettingsPage.css';

const KnowledgeBaseSettingsPage = () => {
  const [config, setConfig] = useState({
    similarity_threshold: 0.78,
    max_chunks: 5,
    use_top_chunks: 3,
    debug_mode: false
  });
  const [healthStatus, setHealthStatus] = useState(null);
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState({ type: '', message: '' });

  const getToken = async () => {
    const sessionData = await supabase.auth.getSession();
    const session = sessionData?.data?.session;
    return session ? session.access_token : null;
  };

  // Load current configuration
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'kb_retrieval_config')
          .single();
        
        if (data) {
          setConfig(JSON.parse(data.setting_value));
        }
      } catch (error) {
        console.error('Error fetching KB config:', error);
      }
    };
    
    fetchConfig();
  }, []);

  // Run health check
  const runHealthCheck = async () => {
    setLoading(true);
    setNotification({ type: '', message: '' });
    
    try {
      const token = await getToken();
      const response = await axios.get('/api/admin/kb/health-check', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      setHealthStatus(response.data);
      
      // Set notification based on status
      if (response.data.status === 'healthy') {
        setNotification({ type: 'success', message: 'Knowledge Base is healthy!' });
      } else if (response.data.status === 'degraded') {
        setNotification({ type: 'warning', message: 'Knowledge Base has some warnings.' });
      } else {
        setNotification({ type: 'error', message: 'Knowledge Base has errors that need attention.' });
      }
    } catch (error) {
      console.error('Health check error:', error);
      setNotification({ type: 'error', message: 'Failed to run health check' });
    }
    
    setLoading(false);
  };

  // Save configuration
  const saveConfig = async () => {
    setSaving(true);
    setNotification({ type: '', message: '' });
    
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ 
          setting_value: JSON.stringify(config),
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'kb_retrieval_config');
      
      if (error) throw error;
      
      setNotification({ type: 'success', message: 'Configuration saved successfully!' });
    } catch (error) {
      console.error('Error saving config:', error);
      setNotification({ type: 'error', message: 'Failed to save configuration' });
    }
    
    setSaving(false);
  };

  // Test query
  const runTestQuery = async () => {
    if (!testQuery.trim()) {
      setNotification({ type: 'error', message: 'Please enter a test query' });
      return;
    }
    
    setLoading(true);
    setNotification({ type: '', message: '' });
    
    try {
      const token = await getToken();
      const response = await axios.post('/api/admin/kb/test-query', 
        { query: testQuery },
        { headers: token ? { 'Authorization': `Bearer ${token}` } : {} }
      );
      
      setTestResults(response.data);
      setNotification({ 
        type: 'success', 
        message: `Found ${response.data.chunks_found} relevant chunks in ${response.data.total_time_ms}ms` 
      });
    } catch (error) {
      console.error('Test query error:', error);
      setNotification({ type: 'error', message: 'Failed to run test query' });
    }
    
    setLoading(false);
  };

  return (
    <div className="kb-settings-container">
      <h1 className="page-header">Knowledge Base Settings</h1>
      
      {notification.message && (
        <div className={`${notification.type === 'success' ? 'success' : notification.type === 'warning' ? 'warning' : 'error'}-message`}>
          {notification.message}
        </div>
      )}

      {/* Configuration Settings */}
      <div className="card mb-2">
        <div className="card-header">Retrieval Configuration</div>
        <div className="settings-form">
          <div className="form-group">
            <label htmlFor="similarity_threshold">
              Similarity Threshold ({config.similarity_threshold})
              <span className="help-text">Lower = more results, Higher = more relevant results</span>
            </label>
            <input
              type="range"
              id="similarity_threshold"
              min="0.5"
              max="0.95"
              step="0.01"
              value={config.similarity_threshold}
              onChange={(e) => setConfig({...config, similarity_threshold: parseFloat(e.target.value)})}
            />
          </div>

          <div className="form-group">
            <label htmlFor="max_chunks">
              Maximum Chunks to Retrieve ({config.max_chunks})
              <span className="help-text">Number of chunks to fetch from database</span>
            </label>
            <input
              type="range"
              id="max_chunks"
              min="1"
              max="20"
              step="1"
              value={config.max_chunks}
              onChange={(e) => setConfig({...config, max_chunks: parseInt(e.target.value)})}
            />
          </div>

          <div className="form-group">
            <label htmlFor="use_top_chunks">
              Use Top Chunks ({config.use_top_chunks})
              <span className="help-text">Number of best chunks to include in context</span>
            </label>
            <input
              type="range"
              id="use_top_chunks"
              min="1"
              max="10"
              step="1"
              value={config.use_top_chunks}
              onChange={(e) => setConfig({...config, use_top_chunks: parseInt(e.target.value)})}
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={config.debug_mode}
                onChange={(e) => setConfig({...config, debug_mode: e.target.checked})}
              />
              Enable Debug Mode
              <span className="help-text">Log detailed information about KB retrieval</span>
            </label>
          </div>

          <button 
            className="button primary" 
            onClick={saveConfig} 
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* Health Check */}
      <div className="card mb-2">
        <div className="card-header">Knowledge Base Health</div>
        <div className="health-check-section">
          <button 
            className="button secondary" 
            onClick={runHealthCheck} 
            disabled={loading}
          >
            {loading ? 'Checking...' : 'Run Health Check'}
          </button>

          {healthStatus && (
            <div className="health-results">
              <h3>Status: <span className={`status-${healthStatus.status}`}>{healthStatus.status.toUpperCase()}</span></h3>
              <ul className="health-checks">
                {Object.entries(healthStatus.checks).map(([key, check]) => (
                  <li key={key} className={`check-${check.status}`}>
                    <strong>{key.replace(/_/g, ' ').toUpperCase()}:</strong> {check.message}
                    {check.count !== undefined && ` (${check.count})`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Test Query */}
      <div className="card">
        <div className="card-header">Test Knowledge Base Query</div>
        <div className="test-query-section">
          <div className="form-group">
            <label htmlFor="testQuery">Test Query</label>
            <input
              type="text"
              id="testQuery"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              placeholder="Enter a test query to search the knowledge base..."
              onKeyPress={(e) => e.key === 'Enter' && runTestQuery()}
            />
          </div>
          
          <button 
            className="button primary" 
            onClick={runTestQuery} 
            disabled={loading || !testQuery.trim()}
          >
            {loading ? 'Searching...' : 'Run Test Query'}
          </button>

          {testResults && (
            <div className="test-results">
              <h4>Results Summary:</h4>
              <p>Found {testResults.chunks_found} chunks in {testResults.total_time_ms}ms</p>
              <p>Embedding: {testResults.embedding_time_ms}ms | Search: {testResults.search_time_ms}ms</p>
              
              {testResults.results.length > 0 && (
                <>
                  <h4>Top Results:</h4>
                  <div className="results-list">
                    {testResults.results.map((result, idx) => (
                      <div key={idx} className="result-item">
                        <div className="result-header">
                          <strong>#{result.rank}</strong> - {result.document}
                          <span className={`similarity ${result.similarity >= 0.9 ? 'high' : result.similarity >= 0.8 ? 'medium' : 'low'}`}>
                            {(result.similarity * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="result-preview">{result.text_preview}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseSettingsPage; 