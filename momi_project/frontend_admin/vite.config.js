import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/admin/', // Crucial for deploying to a sub-path
  server: {
    host: '0.0.0.0',
    port: 5000,
    strictPort: true,
    allowedHosts: ['.replit.dev'], // Allow requests from any replit subdomain
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // Your backend server address
        changeOrigin: true,
        // secure: false, // Uncomment if your backend is on HTTPS with self-signed cert
      }
    }
  }
}); 