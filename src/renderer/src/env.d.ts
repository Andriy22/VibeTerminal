import type { VibeApi } from '@shared/api'

declare global {
  interface Window {
    vibe: VibeApi
  }
}

declare module '*.css'
