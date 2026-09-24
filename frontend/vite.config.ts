import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Chat is served by the Python backend (backend-python/); everything else by Node.
      '/api/chat': {
        target: process.env.CHAT_API_TARGET ?? 'http://localhost:5002',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
});
