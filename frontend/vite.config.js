import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        secure: false,
        // Keep response headers including Content-Disposition unchanged
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // Ensure Content-Disposition is not stripped
            if (proxyRes.headers['content-disposition']) {
              proxyRes.headers['access-control-expose-headers'] = 'Content-Disposition';
            }
          });
        },
      },
      '/auth': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        secure: false,
      },
      '/logout': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        secure: false,
      },
    }
  }
})
