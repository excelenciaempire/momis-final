import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/widget/',
  build: {
    rollupOptions: {
      output: {
        format: 'iife', // Build as an Immediately Invoked Function Expression
        entryFileNames: `assets/[name].js`, // Consistent naming, no hash for loader
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      }
    },
    // outDir: 'dist', // Default
    // assetsDir: 'assets', // Default
    // manifest: true, // Could be useful if we want the backend to read asset names
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // Your backend server address
        changeOrigin: true,
        secure: false,      // If your backend is not HTTPS locally
        // rewrite: (path) => path.replace(/^\/api/, '') // Optional: if your backend doesn't expect /api prefix
      }
    }
  }
})
