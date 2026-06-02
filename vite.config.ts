import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Fatiamento do bundle: vendors grandes vão para chunks próprios e cacheáveis,
// para o chunk principal não carregar tudo de uma vez (melhora o 1º load e o
// cache entre deploys — essas libs mudam pouco).
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
          'icons': ['lucide-react'],
        },
      },
    },
  },
})
