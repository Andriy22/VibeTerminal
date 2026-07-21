import { useEffect } from 'react'
import { useApp } from './store'
import { ptyBridge } from './ptyBridge'
import { applyTheme } from './theme'
import { toggleDictation } from './dictation'
import { eventToHotkey } from './hotkey'
import Sidebar from './components/Sidebar'
import WorkspaceView from './components/WorkspaceView'
import LauncherModal from './components/LauncherModal'
import SettingsModal from './components/SettingsModal'
import MemoryModal from './components/MemoryModal'
import Onboarding from './components/Onboarding'
import CloseDialog from './components/CloseDialog'
import DeleteDialog from './components/DeleteDialog'
import Toasts from './components/Toasts'

export default function App(): JSX.Element {
  const refresh = useApp((s) => s.refresh)
  const launcherOpen = useApp((s) => s.launcherOpen)
  const settingsOpen = useApp((s) => s.settingsOpen)
  const memoryOpen = useApp((s) => s.memoryOpen)
  const onboardingOpen = useApp((s) => s.onboardingOpen)
  const closing = useApp((s) => s.closing)
  const deleting = useApp((s) => s.deleting)
  const theme = useApp((s) => s.settings?.theme)
  const glass = useApp((s) => s.settings?.glass)

  useEffect(() => {
    ptyBridge.init()
    void refresh()
    void window.vibe.getSettings().then(useApp.getState().setSettingsState)
    if (!localStorage.getItem('vt-onboarded')) {
      useApp.getState().openOnboarding(true)
    }
    return window.vibe.onWorkspacesChanged(() => void refresh())
  }, [refresh])

  useEffect(() => {
    applyTheme(theme, glass)
  }, [theme, glass])

  // Dictation hotkey — capture phase so it wins over the focused terminal.
  const dictationHotkey = useApp((s) => s.settings?.dictationHotkey)
  useEffect(() => {
    if (!dictationHotkey) return
    const handler = (e: KeyboardEvent): void => {
      if (eventToHotkey(e) === dictationHotkey) {
        e.preventDefault()
        e.stopPropagation()
        toggleDictation()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [dictationHotkey])

  return (
    <div className="app">
      <Sidebar />
      <main className="app-main">
        <WorkspaceView />
      </main>
      {launcherOpen && <LauncherModal />}
      {settingsOpen && <SettingsModal />}
      {memoryOpen && <MemoryModal />}
      {onboardingOpen && <Onboarding />}
      {closing && <CloseDialog />}
      {deleting && <DeleteDialog />}
      <Toasts />
    </div>
  )
}
