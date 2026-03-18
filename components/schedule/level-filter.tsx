const LEVELS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "AA", label: "AA" },
  { value: "A", label: "A" },
  { value: "BB", label: "BB" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
]

export function LevelFilter({
  active,
  onChange,
}: {
  active: string
  onChange: (value: string) => void
}) {
  return (
    <div className="feed-filters">
      {LEVELS.map((l) => (
        <button
          key={l.value}
          className={`feed-filter-btn${active === l.value ? " active" : ""}`}
          onClick={() => onChange(l.value)}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
