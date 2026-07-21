const MODIFIER_KEYS = ['Meta', 'Control', 'Alt', 'Shift']

/** Serialize a keydown into a stable hotkey signature, e.g. "Meta+Shift+KeyD". */
export function eventToHotkey(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.includes(e.key)) return null
  const mods: string[] = []
  if (e.metaKey) mods.push('Meta')
  if (e.ctrlKey) mods.push('Control')
  if (e.altKey) mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')
  const isFunctionKey = /^F\d+$/.test(e.key)
  if (mods.length === 0 && !isFunctionKey) return null
  return [...mods, e.code].join('+')
}

const PART_LABELS: Record<string, string> = {
  Meta: '⌘',
  Control: '⌃',
  Alt: '⌥',
  Shift: '⇧',
  Space: 'Space'
}

export function formatHotkey(hotkey: string): string {
  return hotkey
    .split('+')
    .map((part) => {
      if (PART_LABELS[part]) return PART_LABELS[part]
      if (part.startsWith('Key')) return part.slice(3)
      if (part.startsWith('Digit')) return part.slice(5)
      return part
    })
    .join('')
}
