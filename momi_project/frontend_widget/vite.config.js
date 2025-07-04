import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/widget/',
  build: {
    // cssCodeSplit: true, // Default is true, ensures CSS is extracted
    rollupOptions: {
      output: {
        format: 'es', // ES Module format
        entryFileNames: `assets/widget-loader.js`, // Consistent name for JS, no hash
        chunkFileNames: `assets/widget-chunk.js`, // Consistent name for chunks, no hash
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'assets/widget-styles.css';
          }
          return `assets/[name].[ext]`;
        },
      }
    },
    // outDir: 'dist', // Default
    // assetsDir: 'assets', // Default
    // manifest: true, // Generates manifest.json, useful for server-side integration
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
