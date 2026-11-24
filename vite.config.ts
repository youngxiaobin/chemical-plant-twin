import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const simPort = process.env.SIM_PORT ?? '4318';
const webPort = Number(process.env.PORT ?? 4317);
const webHost = '127.0.0.1';

export default defineConfig({
  plugins: [react()],
  server: {
    host: webHost,
    port: webPort,
    strictPort: true,
    proxy: {
      '/api': { target: `http://127.0.0.1:${simPort}`, changeOrigin: true },
    },
  },
  preview: {
    host: webHost,
    port: webPort,
    strictPort: true,
    proxy: {
      '/api': { target: `http://127.0.0.1:${simPort}`, changeOrigin: true },
    },
  },
});
