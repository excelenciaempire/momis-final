import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api', // Base URL for all API requests
});

// Add a request interceptor to include the auth token in headers
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin-session-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('API Request with token:', config.url, 'Token:', token.substring(0, 10) + '...');
    } else {
      console.warn('No admin token found for API request:', config.url);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;
