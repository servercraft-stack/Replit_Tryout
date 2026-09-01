import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import monacoEditorPlugin from 'vite-plugin-monaco-editor'

const monaco = (monacoEditorPlugin as any).default || monacoEditorPlugin

export default defineConfig({
  plugins: [
    react(),
    monaco({
      languageWorkers: ['editorWorkerService', 'css', 'html', 'json', 'typescript'],
    }),
  ],
  resolve: {
    alias: {
      'monaco-editor/esm/vs/editor/editor.api.js': fileURLToPath(new URL('./node_modules/monaco-editor/esm/vs/editor/editor.api.js', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
      },
    },
  },
})
