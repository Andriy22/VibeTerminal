import { useEffect, useRef, useState } from 'react'
import type { PathSuggestion } from '@shared/types'

interface Props {
  value: string
  onChange: (value: string) => void
}

/** cd-style folder input: type an absolute path, Tab/Enter completes subfolders. */
export default function PathInput({ value, onChange }: Props): JSX.Element {
  const [suggestions, setSuggestions] = useState<PathSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const debounceRef = useRef<number>(0)

  useEffect(() => {
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(async () => {
      const results = await window.vibe.suggestPaths(value)
      setSuggestions(results)
      setHighlight(0)
    }, 120)
    return () => window.clearTimeout(debounceRef.current)
  }, [value])

  const complete = (suggestion: PathSuggestion): void => {
    onChange(suggestion.path + '/')
    setOpen(true)
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (!open || suggestions.length === 0) {
      if (e.key === 'Tab') e.preventDefault()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault()
      complete(suggestions[highlight])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="path-input">
      <input
        value={value}
        spellCheck={false}
        placeholder="/absolute/path/to/project or ~/project"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      {open && suggestions.length > 0 && (
        <ul className="path-suggestions">
          {suggestions.map((s, i) => (
            <li
              key={s.path}
              className={i === highlight ? 'highlight' : ''}
              onMouseDown={(e) => {
                e.preventDefault()
                complete(s)
              }}
            >
              {s.name}/
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
