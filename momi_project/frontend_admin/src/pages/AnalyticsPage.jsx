import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { supabase } from '../supabaseClient';
import './AnalyticsPage.css'; // We'll create this CSS file next

const AnalyticsPage = () => {
  const [analyticsData, setAnalyticsData] = useState({
    totalRegisteredUsers: 0,
    totalGuestUsers: 0,
    totalConversations: 0,
    messagesToday: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalyticsSummary = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Not authenticated. Please log in.');

      const response = await axios.get('/api/admin/analytics/summary', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setAnalyticsData(response.data);
    } catch (err) {
      console.error('Error fetching analytics summary:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load analytics summary.');
      // Keep existing data or reset to zeros if preferred on error
      setAnalyticsData({
        totalRegisteredUsers: 'N/A',
        totalGuestUsers: 'N/A',
        totalConversations: 'N/A',
        messagesToday: 'N/A',
      });
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchAnalyticsSummary();
  }, [fetchAnalyticsSummary]);

  return (
    <div className="analytics-page">
      <h2>MOMi Analytics Dashboard</h2>
      
      {isLoading && <p className="loading-message">Loading analytics data...</p>}
      {error && <p className="error-message analytics-error">{error}</p>}

      {!isLoading && !error && (
        <div className="analytics-summary">
          <div className="summary-card">
            <h3>Registered Users</h3>
            <p className="count">{analyticsData.totalRegisteredUsers}</p>
            {/* <p className="trend">+5% from last week</p> */}
          </div>
          <div className="summary-card">
            <h3>Guest Sessions</h3>
            <p className="count">{analyticsData.totalGuestUsers}</p>
          </div>
          <div className="summary-card">
            <h3>Total Conversations</h3>
            <p className="count">{analyticsData.totalConversations}</p>
          </div>
          <div className="summary-card">
            <h3>Messages Today</h3>
            <p className="count">{analyticsData.messagesToday}</p>
          </div>
        </div>
      )}

      <div className="charts-area">
        <h3>Engagement Trends (Placeholder)</h3>
        <div className="chart-placeholder">
          <p>Chart: Messages per day (Last 30 days)</p>
          {/* Placeholder for a chart component */}
        </div>
        <div className="chart-placeholder">
          <p>Chart: Active Users (Weekly)</p>
          {/* Placeholder for a chart component */}
        </div>
      </div>

      <div className="feature-notice">
        <p><strong>Note:</strong> This is a placeholder for the analytics dashboard. Real data and interactive charts will be implemented in a future update.</p>
      </div>
    </div>
  );
};

export default AnalyticsPage; 