import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const resolveCommitHash = (): string => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_BUILD_HASH': JSON.stringify(process.env.VITE_BUILD_HASH || resolveCommitHash()),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(process.env.VITE_BUILD_TIME || new Date().toISOString()),
  },
  resolve: {
    alias: {
      '@arona-chat/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
})
