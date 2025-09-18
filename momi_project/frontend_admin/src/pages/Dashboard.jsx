import React, { useState, useEffect } from 'react';
import apiClient from '../apiClient';
import './Dashboard.css';

const StatCard = ({ title, value, icon }) => (
  <div className="stat-card">
    <div className="stat-card-icon">{icon}</div>
    <div className="stat-card-info">
      <span className="stat-card-title">{title}</span>
      <span className="stat-card-value">{value}</span>
    </div>
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setError('');
        setLoading(true);
        const response = await apiClient.get('/admin/analytics/summary');
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
    <div>
      <h1 className="page-header">MOMI Analytics Dashboard</h1>

      {loading && <p>Loading dashboard...</p>}
      {error && <div className="error-message">{error}</div>}

      {stats && !loading && (
        <div className="stats-grid">
          <StatCard title="Registered Users" value={stats.totalRegisteredUsers} icon="👥" />
          <StatCard title="Guest Users" value={stats.totalGuestUsers} icon="👤" />
          <StatCard title="Total Conversations" value={stats.totalConversations} icon="💬" />
          <StatCard title="Messages Today" value={stats.messagesToday} icon="📅" />
        </div>
      )}
    </div>
  );
};

export default Dashboard;
