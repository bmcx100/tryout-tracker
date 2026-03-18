import { Skeleton } from "@/components/ui/skeleton"

export default function HomeLoading() {
  return (
    <div className="app-page">
      <div className="app-page-header">
        <Skeleton className="loading-title" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="loading-card" />
      ))}
    </div>
  )
}
