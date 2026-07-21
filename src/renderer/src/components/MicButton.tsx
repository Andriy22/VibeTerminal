import { useApp } from '../store'
import { toggleDictation } from '../dictation'
import { formatHotkey } from '../hotkey'
import Icon from './Icon'

/** Dictation toggle — same action as the configurable hotkey. */
export default function MicButton(): JSX.Element {
  const state = useApp((s) => s.micState)
  const hotkey = useApp((s) => s.settings?.dictationHotkey)
  const shortcut = hotkey ? ` (${formatHotkey(hotkey)})` : ''
  const title =
    state === 'recording'
      ? 'Stop recording'
      : state === 'transcribing'
        ? 'Transcribing…'
        : `Dictate into the focused pane${shortcut}`

  return (
    <button className={`tool-button mic ${state}`} title={title} onClick={toggleDictation}>
      {state === 'recording' ? (
        <span className="rec-dot" />
      ) : state === 'transcribing' ? (
        <span className="spinner" />
      ) : (
        <Icon name="mic" />
      )}
    </button>
  )
}
