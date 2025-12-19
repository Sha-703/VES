import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Use a relative base so assets load correctly when opening `dist/index.html` from file://
export default defineConfig({
  base: './',
  plugins: [react()]
})
