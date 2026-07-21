import { create } from 'zustand'
import type { Settings, WorkspaceSnapshot } from '@shared/types'

interface Toast {
  id: number
  message: string
}

interface AppState {
  snapshot: WorkspaceSnapshot[]
  groupColors: Record<string, string>
  settings: Settings | null
  activeId: string | null
  launcherOpen: boolean
  settingsOpen: boolean
  memoryOpen: boolean
  onboardingOpen: boolean
  /** Center area view: agent terminals, file explorer, or git changes. */
  workspaceView: 'term' | 'files' | 'diff'
  /** paneId currently maximized in the active workspace */
  maximizedPane: string | null
  /** pane the user last clicked — dictation types here */
  focusedPane: { workspaceId: string; paneId: string } | null
  micState: 'idle' | 'recording' | 'transcribing'
  /** Detected foreground process per ptyId — drives live kind display. */
  paneProcs: Record<string, string>
  /** Activity per ptyId: streaming output, waiting for input, or quiet. */
  paneActivity: Record<string, 'working' | 'attention' | 'idle'>
  /** workspace pending the close dialog, with its dirty worktrees */
  closing: { workspaceId: string; dirty: string[] } | null
  /** workspace pending the delete dialog, with its dirty worktrees */
  deleting: { workspaceId: string; dirty: string[] } | null
  toasts: Toast[]

  refresh: () => Promise<void>
  setSettingsState: (settings: Settings) => void
  setActive: (id: string | null) => void
  openLauncher: (open: boolean) => void
  openSettings: (open: boolean) => void
  openMemory: (open: boolean) => void
  openOnboarding: (open: boolean) => void
  setWorkspaceView: (view: 'term' | 'files' | 'diff') => void
  setMaximized: (paneId: string | null) => void
  setFocusedPane: (pane: { workspaceId: string; paneId: string } | null) => void
  setMicState: (state: 'idle' | 'recording' | 'transcribing') => void
  setPaneProc: (ptyId: string, name: string) => void
  setPaneActivity: (ptyId: string, state: 'working' | 'attention' | 'idle') => void
  setClosing: (closing: { workspaceId: string; dirty: string[] } | null) => void
  setDeleting: (deleting: { workspaceId: string; dirty: string[] } | null) => void
  toast: (message: string) => void
  dismissToast: (id: number) => void
}

let toastSeq = 0

export const useApp = create<AppState>((set, get) => ({
  snapshot: [],
  groupColors: {},
  settings: null,
  activeId: null,
  launcherOpen: false,
  settingsOpen: false,
  memoryOpen: false,
  onboardingOpen: false,
  workspaceView: 'term',
  maximizedPane: null,
  focusedPane: null,
  micState: 'idle',
  paneProcs: {},
  paneActivity: {},
  closing: null,
  deleting: null,
  toasts: [],

  refresh: async () => {
    const [snapshot, groupColors] = await Promise.all([
      window.vibe.snapshot(),
      window.vibe.getGroupColors()
    ])
    set({ groupColors })
    set((state) => {
      let activeId = state.activeId
      const running = snapshot.filter((w) => w.running)
      const activeStillExists = snapshot.some((w) => w.config.id === activeId)
      if (!activeStillExists) activeId = running[0]?.config.id ?? null
      return { snapshot, activeId }
    })
  },

  setSettingsState: (settings) => set({ settings }),
  setActive: (id) => {
    const workspace = get().snapshot.find((w) => w.config.id === id)
    const firstPane = workspace?.config.panes[0]
    set({
      activeId: id,
      maximizedPane: null,
      focusedPane: id && firstPane ? { workspaceId: id, paneId: firstPane.id } : null
    })
  },
  openLauncher: (open) => set({ launcherOpen: open }),
  openSettings: (open) => set({ settingsOpen: open }),
  openMemory: (open) => set({ memoryOpen: open }),
  openOnboarding: (open) => set({ onboardingOpen: open }),
  setWorkspaceView: (workspaceView) => set({ workspaceView }),
  setMaximized: (paneId) => set({ maximizedPane: paneId }),
  setFocusedPane: (pane) => set({ focusedPane: pane }),
  setMicState: (micState) => set({ micState }),
  setPaneProc: (ptyId, name) => {
    if (get().paneProcs[ptyId] === name) return
    set({ paneProcs: { ...get().paneProcs, [ptyId]: name } })
  },
  setPaneActivity: (ptyId, state) => {
    if (get().paneActivity[ptyId] === state) return
    set({ paneActivity: { ...get().paneActivity, [ptyId]: state } })
  },
  setClosing: (closing) => set({ closing }),
  setDeleting: (deleting) => set({ deleting }),

  toast: (message) => {
    const id = ++toastSeq
    set({ toasts: [...get().toasts, { id, message }] })
    setTimeout(() => get().dismissToast(id), 6000)
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) })
}))
