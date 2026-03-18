const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "bff", label: "BFFs" },
  { value: "teammate", label: "Teammates" },
  { value: "old_teammate", label: "Old Teammates" },
  { value: "friend", label: "Friends" },
]

export function FeedFilters({
  active,
  onChange,
}: {
  active: string
  onChange: (value: string) => void
}) {
  return (
    <div className="feed-filters">
      {FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          className={`feed-filter-btn${active === opt.value ? " active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
