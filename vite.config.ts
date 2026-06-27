import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

/**
 * Vite root = src/renderer/  (index.html + all Vue source)
 * Electron main = src/main/
 * Electron preload = src/preload/
 */
export default defineConfig({
  plugins: [vue()],
  base: '',
  root: path.join(__dirname, 'src', 'renderer'),
  build: {
    outDir: path.join(__dirname, 'renderer', 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.join(__dirname, 'src', 'renderer', 'index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src', 'renderer'),
      '@shared': path.join(__dirname, 'src', 'shared'),
    },
  },
  server: {
    port: 5177,
    host: '127.0.0.1',
    strictPort: true,
    hmr: { overlay: true },
    watch: { usePolling: true },
  },
  css: {
    preprocessorOptions: {
      scss: { api: 'modern' },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
  },
});