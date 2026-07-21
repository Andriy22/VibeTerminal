import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// No StrictMode: its dev-mode double-mount disposes live xterm instances
// and replays pty subscriptions, which corrupts terminal state.
createRoot(document.getElementById('root')!).render(<App />)
