/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // Compiles src/firebase-messaging-sw.ts into dist/firebase-messaging-sw.js using
    // a separate Vite sub-build so that import.meta.env.VITE_* values are baked in at
    // build time.  injectionPoint: undefined skips workbox precache injection entirely
    // (we only need the FCM background handler, not precaching).  rollupFormat: 'iife'
    // is required because Firebase's SDK registers the SW as a classic script with no
    // type:'module', so the output must not contain bare ES import/export statements.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'firebase-messaging-sw.ts',
      injectRegister: false,
      manifest: false,
      injectManifest: {
        injectionPoint: undefined,
        rollupFormat: 'iife',
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
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
