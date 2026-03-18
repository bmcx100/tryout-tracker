import { Skeleton } from "@/components/ui/skeleton"

export default function CrewLoading() {
  return (
    <div className="app-page">
      <div className="app-page-header">
        <Skeleton className="loading-title" />
        <Skeleton className="loading-button" />
      </div>
      <div className="loading-group">
        <Skeleton className="loading-group-header" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="loading-card" />
        ))}
      </div>
    </div>
  )
}
