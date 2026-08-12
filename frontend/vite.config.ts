import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const backendTarget = env.VITE_BACKEND_URL || 'http://127.0.0.1:1996'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: true, // Listen on all addresses (0.0.0.0)
      port: 5173,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/socket.io': {
          target: backendTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    build: {
      sourcemap: false, // Disable source maps in production
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined

            if (
              id.includes('react-markdown') ||
              id.includes('remark-') ||
              id.includes('rehype-') ||
              id.includes('unified')
            ) {
              return 'markdown'
            }

            if (
              id.includes('recharts') ||
              id.includes('d3-')
            ) {
              return 'charts'
            }

            if (
              id.includes('react-router') ||
              id.includes('@tanstack/')
            ) {
              return 'router-query'
            }

            if (
              id.includes('framer-motion') ||
              id.includes('lucide-react')
            ) {
              return 'ui-motion'
            }

            if (
              id.includes('@radix-ui/') ||
              id.includes('/cmdk/')
            ) {
              return 'radix-ui'
            }

            if (
              id.includes('@tiptap/') ||
              id.includes('/prosemirror-') ||
              id.includes('/lowlight/')
            ) {
              return 'editor-core'
            }

            if (id.includes('/date-fns/')) {
              return 'date-utils'
            }

            if (
              id.includes('/i18next/') ||
              id.includes('/react-i18next/')
            ) {
              return 'i18n'
            }

            if (
              id.includes('/axios/') ||
              id.includes('/socket.io-client/')
            ) {
              return 'network'
            }

            if (id.includes('@hello-pangea/dnd')) {
              return 'dnd'
            }

            if (
              id.includes('/react-hook-form/') ||
              id.includes('@hookform/resolvers') ||
              id.includes('/zod/')
            ) {
              return 'forms-validation'
            }

            if (
              id.includes('/zustand/') ||
              id.includes('/next-themes/')
            ) {
              return 'state-theme'
            }

            return 'vendor'
          },
        },
      },
    },
  }
})
