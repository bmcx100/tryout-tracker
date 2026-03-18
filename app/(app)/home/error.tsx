"use client"

export default function HomeError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="app-page">
      <div className="app-empty-state">
        <p className="app-empty-title">Something went wrong</p>
        <p className="app-empty-desc">
          Failed to load home. Please try again.
        </p>
        <button className="btn-primary" onClick={reset}>
          Try Again
        </button>
      </div>
    </div>
  )
}
