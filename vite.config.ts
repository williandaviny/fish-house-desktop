import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['sql.js']
  },
  server: {
    port: 5174,
    host: true
  }
});
