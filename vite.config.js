import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html',
        customer: './customer/index.html',
        staff: './staff/index.html'
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
})
