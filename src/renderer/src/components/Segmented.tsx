interface Option<T> {
  value: T
  label: string
}

export default function Segmented<T extends string | number | null>({
  options,
  value,
  onChange
}: {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
}): JSX.Element {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((option) => (
        <button
          key={String(option.value)}
          role="radio"
          aria-checked={option.value === value}
          className={`segment ${option.value === value ? 'selected' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
