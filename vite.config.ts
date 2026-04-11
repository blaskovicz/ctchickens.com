/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase-vendor': ['firebase/app', 'firebase/firestore', 'firebase/auth', 'firebase/storage'],
          'bootstrap-vendor': ['bootstrap-vue-next', 'bootstrap']
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    env: {
      VITE_APP_USE_EMULATOR: 'true',
      VITE_FIREBASE_PROJECT_ID: "demo-ct-chickens",
      VITE_FIREBASE_API_KEY: "fake-key",
      VITE_FIREBASE_AUTH_DOMAIN: "demo-ct-chickens.firebaseapp.com",
      VITE_FIREBASE_STORAGE_BUCKET: "demo-ct-chickens.appspot.com",
      VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789',
      VITE_FIREBASE_APP_ID: '1:123456789:web:abcdef'
    }
  }
})
