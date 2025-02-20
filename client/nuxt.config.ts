import { devOnly } from './utils/devOnly';
import { iconSafelist } from './utils/icons';

export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      vapidKey: process.env.VIEWTUBE_PUBLIC_VAPID,
      videoplaybackProxy: '',
      githubHint: false,
      registrationEnabled: true,
      requireLoginEverywhere: false
    }
  },

  nitro: {
    preset: 'node',
    ...devOnly({
      devProxy: {
        '/api': { target: 'http://0.0.0.0:8067/api', changeOrigin: true }
      }
    })
  },

  typescript: {
    strict: true,
    shim: false,
    typeCheck: 'build'
  },

  css: ['@/assets/fonts/expletus.css', '@/assets/fonts/notosans.css', 'tippy.js/dist/tippy.css'],

  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `
           @use "sass:math";
           @import "@/assets/styles/global/variables.scss";
          `
        }
      }
    }
  },

  modules: [
    '@pinia/nuxt',
    '@pinia-plugin-persistedstate/nuxt',
    '@unocss/nuxt',
    '@vueuse/nuxt',
    '@nuxt/eslint'
  ],

  unocss: {
    uno: false,
    icons: true,
    attributify: false,
    safelist: iconSafelist
  },

  piniaPersistedstate: {
    cookieOptions: {
      sameSite: 'strict'
    }
  }
});
