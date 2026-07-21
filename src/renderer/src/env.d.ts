// Ambient file — no top-level imports, or the wildcard module
// declarations below silently stop applying.
declare module '*.css'

declare module '*.md?raw' {
  const content: string
  export default content
}

interface Window {
  vibe: import('@shared/api').VibeApi
}
