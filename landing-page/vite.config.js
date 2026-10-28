import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  // Chemins relatifs : marche en local comme sous /MedFlow/ sur GitHub Pages.
  base: './',
  server: {
    port: 5174,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        livreBlanc: resolve(__dirname, 'livre-blanc.html'),
      },
    },
  },
})
