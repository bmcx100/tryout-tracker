import { Skeleton } from "@/components/ui/skeleton"

export default function TeamsLoading() {
  return (
    <div className="app-page">
      <div className="app-page-header">
        <Skeleton className="loading-title" />
      </div>
      <div className="loading-filters">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="loading-filter" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="loading-card" />
      ))}
    </div>
  )
}
