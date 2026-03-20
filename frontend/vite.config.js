import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// API 地址通过环境变量配置
// 开发时: VITE_API_URL=http://localhost:3001（默认）
// 生产时: VITE_API_URL=https://your-backend.onrender.com
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
