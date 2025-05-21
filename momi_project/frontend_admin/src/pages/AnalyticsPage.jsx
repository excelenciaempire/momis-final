import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { supabase } from '../supabaseClient';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale, // Import TimeScale for time series data
} from 'chart.js';
import 'chartjs-adapter-date-fns'; // Import for side effects (auto-registration)
import { Line } from 'react-chartjs-2';
// import { format } from 'date-fns'; // No longer explicitly needed here for chart labels
import './AnalyticsPage.css'; // Page-specific styles

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  // Adapter is registered by the import above
);

const chartOptions = (chartTitle) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
    },
    title: {
      display: true,
      text: chartTitle,
      font: { size: 16 }
    },
  },
  scales: {
    x: {
      type: 'time',
      time: {
        unit: 'day',
        tooltipFormat: 'MMM d, yyyy', // e.g., Jan 1, 2023
        displayFormats: {
          day: 'MMM d' // e.g., Jan 1
        }
      },
      title: {
        display: true,
        text: 'Date'
      }
    },
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: 'Count'
      }
    }
  }
});

const AnalyticsPage = () => {
  const [summaryData, setSummaryData] = useState({
    totalRegisteredUsers: 0,
    totalGuestUsers: 0,
    totalConversations: 0,
    messagesToday: 0,
  });
  const [messagesChartData, setMessagesChartData] = useState({ labels: [], datasets: [] });
  const [activeUsersChartData, setActiveUsersChartData] = useState({ labels: [], datasets: [] });
  const [isLoading, setIsLoading] = useState({ summary: true, charts: true });
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading({ summary: true, charts: true });
    setError('');
    let token = null;
    try {
      const sessionData = await supabase.auth.getSession();
      const session = sessionData?.data?.session;
      // if (!session) throw new Error('Not authenticated. Please log in.'); // Allow proceeding for preview
      if (session) {
        token = session.access_token;
      } else {
        console.warn("AnalyticsPage: No active session, proceeding for preview. API calls may fail if auth is enforced by backend.");
        // For local preview without backend auth, you might use a placeholder or skip auth headers.
        // If backend authAdmin middleware is truly bypassed, null token might be fine or backend might not care.
      }

      // Fetch Summary Data
      const summaryRes = await axios.get('/api/admin/analytics/summary', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setSummaryData(summaryRes.data);
      setIsLoading(prev => ({ ...prev, summary: false }));

      // Fetch Messages Over Time Data (e.g., last 30 days)
      const messagesRes = await axios.get('/api/admin/analytics/messages-over-time?period=30d', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const messagesData = messagesRes.data.map(item => ({ x: new Date(item.date), y: item.count }));
      setMessagesChartData({
        // labels: messagesData.map(item => format(item.x, 'MMM d')), // Chart.js time scale handles labels
        datasets: [{
          label: 'Messages per Day',
          data: messagesData,
          borderColor: 'var(--primary-accent)',
          backgroundColor: 'rgba(145, 61, 154, 0.2)',
          fill: true,
          tension: 0.1
        }]
      });

      // Fetch Daily Active Users Data
      const activeUsersRes = await axios.get('/api/admin/analytics/daily-active-users?period=30d', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const activeUsersData = activeUsersRes.data.map(item => ({ x: new Date(item.date), y: item.count }));
      setActiveUsersChartData({
        // labels: activeUsersData.map(item => format(item.x, 'MMM d')),
        datasets: [{
          label: 'Daily Active Users',
          data: activeUsersData,
          borderColor: 'var(--secondary-accent)',
          backgroundColor: 'rgba(197, 66, 193, 0.2)',
          fill: true,
          tension: 0.1
        }]
      });
      setIsLoading(prev => ({ ...prev, charts: false }));

    } catch (err) {
      console.error('Error fetching analytics data:', err);
      const errMsg = err.response?.data?.error || err.message || 'Failed to load analytics data.';
      // If the error is due to auth and we are in preview mode, customize message
      if (!token && (err.response?.status === 401 || err.response?.status === 403)) {
        setError("Preview mode: Could not fetch data. Backend authentication might still be active.");
      } else {
        setError(errMsg);
      }
      setIsLoading({ summary: false, charts: false });
      setSummaryData({
        totalRegisteredUsers: 'Err',
        totalGuestUsers: 'Err',
        totalConversations: 'Err',
        messagesToday: 'Err',
      });
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="analytics-page-container">
      <h1 className="page-header">MOMi Analytics Dashboard</h1>
      
      {isLoading.summary && <div className="loading-message card"><p>Loading summary...</p></div>}
      {error && <div className="error-message card">{error}</div>} 

      {!isLoading.summary && !error && (
        <div className="analytics-grid">
          <div className="card summary-item">
            <div className="card-header">Registered Users</div>
            <p className="count">{summaryData.totalRegisteredUsers}</p>
          </div>
          <div className="card summary-item">
            <div className="card-header">Guest Sessions</div>
            <p className="count">{summaryData.totalGuestUsers}</p>
          </div>
          <div className="card summary-item">
            <div className="card-header">Total Conversations</div>
            <p className="count">{summaryData.totalConversations}</p>
          </div>
          <div className="card summary-item">
            <div className="card-header">Messages Today</div>
            <p className="count">{summaryData.messagesToday}</p>
          </div>
        </div>
      )}

      <div className="charts-grid"> 
        <div className="card chart-card">
          {isLoading.charts ? <p className="loading-text">Loading chart data...</p> : 
            (messagesChartData.datasets?.[0]?.data.length > 0 ? 
              <Line options={chartOptions('Messages Over Last 30 Days')} data={messagesChartData} height={300}/> : 
              <p className="empty-text">No message data available for chart.</p>)
          }
        </div>
        <div className="card chart-card">
          {isLoading.charts ? <p className="loading-text">Loading chart data...</p> : 
            (activeUsersChartData.datasets?.[0]?.data.length > 0 ? 
              <Line options={chartOptions('Daily Active Users (Last 30 Days)')} data={activeUsersChartData} height={300}/> : 
              <p className="empty-text">No active user data available for chart.</p>)
          }
        </div>
      </div>

      {/* <div className="card feature-notice mt-2"> 
        <p><strong>Note:</strong> This is a placeholder for the analytics dashboard. Real data and interactive charts will be implemented in a future update.</p>
      </div> */}
    </div>
  );
};

export default AnalyticsPage; 