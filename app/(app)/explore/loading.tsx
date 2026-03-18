import { Skeleton } from "@/components/ui/skeleton"

export default function ExploreLoading() {
  return (
    <div className="app-page">
      <div className="app-page-header">
        <Skeleton className="loading-title" />
      </div>
      <Skeleton className="loading-search" />
      <div className="loading-filters">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="loading-filter" />
        ))}
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="loading-card" />
      ))}
    </div>
  )
}
