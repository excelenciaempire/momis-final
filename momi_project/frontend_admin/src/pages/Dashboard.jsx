import React, { useState, useEffect, useCallback } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import apiClient from '../apiClient';
import { supabase } from '../supabaseClient';
import './Dashboard.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
);

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchStats = useCallback(async () => {
    try {
      const statsResponse = await apiClient.post('/admin/dashboard/stats', {});
      setStats(statsResponse.data);
      setLastUpdated(new Date());
      console.log('Dashboard stats updated:', statsResponse.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError(err.response?.data?.error || 'Failed to fetch dashboard data.');
    }
  }, []);

  const fetchChartData = useCallback(async () => {
    try {
      const messagesResponse = await apiClient.get('/admin/analytics/messages-over-time?period=7d');
      setChartData({
        labels: messagesResponse.data.map(item => new Date(item.date).toLocaleDateString()),
        datasets: [{
          label: 'Messages per Day',
          data: messagesResponse.data.map(item => item.count),
          borderColor: '#913D9A',
          backgroundColor: 'rgba(145, 61, 154, 0.1)',
          fill: true,
          tension: 0.4
        }]
      });
    } catch (chartError) {
      console.log('Chart data not available:', chartError);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setError('');
      setLoading(true);
      await Promise.all([fetchStats(), fetchChartData()]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [fetchStats, fetchChartData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!supabase) return;

    console.log('Setting up real-time subscriptions for dashboard...');

    // Subscribe to user profile changes
    const userProfilesSubscription = supabase
      .channel('user_profiles_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'user_profiles' },
        (payload) => {
          console.log('User profiles changed:', payload);
          fetchStats();
        }
      )
      .subscribe();

    // Subscribe to auth.users changes (new registrations)
    const authUsersSubscription = supabase
      .channel('auth_users_changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'auth', table: 'users' },
        (payload) => {
          console.log('New user registered:', payload);
          // Refresh stats immediately when new user registers
          setTimeout(() => {
            fetchStats();
          }, 1000); // Small delay to allow trigger to complete
        }
      )
      .subscribe();

    // Subscribe to conversations changes
    const conversationsSubscription = supabase
      .channel('conversations_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        (payload) => {
          console.log('Conversations changed:', payload);
          fetchStats();
        }
      )
      .subscribe();

    // Subscribe to messages changes
    const messagesSubscription = supabase
      .channel('messages_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          console.log('Messages changed:', payload);
          fetchStats();
          fetchChartData();
        }
      )
      .subscribe();

    // Auto-refresh every 30 seconds as fallback
    const intervalId = setInterval(() => {
      console.log('Auto-refreshing dashboard stats...');
      fetchStats();
    }, 30000);

    return () => {
      console.log('Cleaning up dashboard subscriptions...');
      userProfilesSubscription.unsubscribe();
      authUsersSubscription.unsubscribe();
      conversationsSubscription.unsubscribe();
      messagesSubscription.unsubscribe();
      clearInterval(intervalId);
    };
  }, [fetchStats, fetchChartData]);

  const userDistributionData = stats ? {
    labels: ['Active Users', 'Total Users'],
    datasets: [{
      data: [stats.active_users_this_week, stats.total_users],
      backgroundColor: ['#913D9A', '#EBC7F2'],
      borderWidth: 0,
    }]
  } : null;

  return (
    <div className="analytics-page-container">
      <div className="dashboard-header">
        <h1 className="page-header">📊 MOMi Analytics Dashboard</h1>
        <div className="dashboard-status">
          <div className="realtime-indicator">
            <span className="status-dot active"></span>
            <span>Live Updates Active</span>
          </div>
          <div className="last-updated">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        </div>
      </div>

      {loading && <div className="loading-message card"><p>Loading dashboard...</p></div>}
      {error && <div className="error-message card">{error}</div>}

      {stats && !loading && (
        <>
          <div className="analytics-grid">
            <div className="card summary-item highlight">
              <div className="summary-icon">👥</div>
              <div className="summary-content">
                <div className="card-header">Total Users</div>
                <p className="count">{stats.total_users}</p>
                <span className="trend positive">+{stats.new_users_this_week} this week</span>
              </div>
            </div>
            
            <div className="card summary-item">
              <div className="summary-icon">💬</div>
              <div className="summary-content">
                <div className="card-header">Conversations</div>
                <p className="count">{stats.total_conversations}</p>
                <span className="trend neutral">Total chats</span>
              </div>
            </div>
            
            <div className="card summary-item">
              <div className="summary-icon">✉️</div>
              <div className="summary-content">
                <div className="card-header">Messages</div>
                <p className="count">{stats.total_messages}</p>
                <span className="trend neutral">{stats.messages_today} today</span>
              </div>
            </div>
            
            <div className="card summary-item">
              <div className="summary-icon">📚</div>
              <div className="summary-content">
                <div className="card-header">Knowledge Base</div>
                <p className="count">{stats.knowledge_base_documents}</p>
                <span className="trend positive">{stats.knowledge_base_chunks} chunks</span>
              </div>
            </div>
          </div>

          <div className="charts-grid">
            {chartData && (
              <div className="card chart-card">
                <div className="card-header">📈 Messages Activity (Last 7 Days)</div>
                <div className="chart-container">
                  <Line 
                    data={chartData} 
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                      },
                      scales: {
                        y: { beginAtZero: true }
                      }
                    }} 
                  />
                </div>
              </div>
            )}
            
            {userDistributionData && (
              <div className="card chart-card">
                <div className="card-header">👥 User Activity</div>
                <div className="chart-container">
                  <Doughnut 
                    data={userDistributionData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'bottom' }
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="quick-actions">
            <div className="card action-card">
              <div className="card-header">🚀 Quick Actions</div>
              <div className="action-buttons">
                <button className="action-btn users" onClick={() => window.location.href = '/admin/users'}>
                  <span className="action-icon">👥</span>
                  Manage Users
                </button>
                <button className="action-btn documents" onClick={() => window.location.href = '/admin/documents'}>
                  <span className="action-icon">📚</span>
                  Upload Documents
                </button>
                <button className="action-btn settings" onClick={() => window.location.href = '/admin/system-prompt'}>
                  <span className="action-icon">⚙️</span>
                  Configure MOMi
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
