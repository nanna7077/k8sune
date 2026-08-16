import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Keep Vite and Tauri on IPv4: some systems resolve `localhost` to ::1,
    // where the development server may not be available.
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
