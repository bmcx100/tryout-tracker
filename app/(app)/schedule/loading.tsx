import { Skeleton } from "@/components/ui/skeleton"

export default function ScheduleLoading() {
  return (
    <div className="app-page">
      <div className="app-page-header">
        <Skeleton className="loading-title" />
      </div>
      <div className="loading-filters">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="loading-filter" />
        ))}
      </div>
      <div className="schedule-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="loading-session-card" />
        ))}
      </div>
    </div>
  )
}
