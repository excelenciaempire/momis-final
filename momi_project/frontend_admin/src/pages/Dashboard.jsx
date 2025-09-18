import React, { useState, useEffect } from 'react';
import apiClient from '../apiClient';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setError('');
        setLoading(true);
        const response = await apiClient.post('/admin/dashboard/stats', {});
        setStats(response.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="analytics-page-container">
      <h1 className="page-header">MOMi Analytics Dashboard</h1>

      {loading && <div className="loading-message card"><p>Loading dashboard...</p></div>}
      {error && <div className="error-message card">{error}</div>}

      {stats && !loading && (
        <div className="analytics-grid">
          <div className="card summary-item">
            <div className="card-header">Total Users</div>
            <p className="count">{stats.total_users}</p>
          </div>
          <div className="card summary-item">
            <div className="card-header">Total Conversations</div>
            <p className="count">{stats.total_conversations}</p>
          </div>
          <div className="card summary-item">
            <div className="card-header">Total Messages</div>
            <p className="count">{stats.total_messages}</p>
          </div>
          <div className="card summary-item">
            <div className="card-header">Messages Today</div>
            <p className="count">{stats.messages_today}</p>
          </div>
          <div className="card summary-item">
            <div className="card-header">New Users (Week)</div>
            <p className="count">{stats.new_users_this_week}</p>
          </div>
          <div className="card summary-item">
            <div className="card-header">Active Users (Week)</div>
            <p className="count">{stats.active_users_this_week}</p>
          </div>
          <div className="card summary-item">
            <div className="card-header">KB Documents</div>
            <p className="count">{stats.knowledge_base_documents}</p>
          </div>
          <div className="card summary-item">
            <div className="card-header">KB Chunks</div>
            <p className="count">{stats.knowledge_base_chunks}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
