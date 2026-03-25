import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/node_modules\/recharts\//.test(id)) return 'vendor-recharts';
          if (/node_modules\/antd\//.test(id)) return 'vendor-antd';
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) {
            return 'vendor-react-core';
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
})
