import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Utilise une base relative pour que les ressources se chargent correctement lors de l'ouverture de `dist/index.html` depuis file://
export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(process.env.VITE_API_BASE_URL || 'https://ves-mg2a.onrender.com'),
  },
})
