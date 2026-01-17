import react from '@vitejs/plugin-react'

// Utilise une base relative pour que les ressources se chargent correctement lors de l'ouverture de `dist/index.html` depuis file://
export default defineConfig({
  base: './',
  plugins: [react()]
})
