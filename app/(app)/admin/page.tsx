import { createClient } from "@/lib/supabase/server"

export default async function AdminDashboard() {
  const supabase = await createClient()

  const [
    { count: playerCount },
    { count: correctionCount },
    { count: pendingUserCount },
  ] = await Promise.all([
    supabase.from("players").select("*", { count: "exact", head: true }),
    supabase.from("corrections").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "pending"),
  ])

  const stats = [
    { label: "Total Players", value: playerCount ?? 0 },
    { label: "Pending Corrections", value: correctionCount ?? 0 },
    { label: "Pending Users", value: pendingUserCount ?? 0 },
  ]

  return (
    <div>
      <h1 className="app-page-title">Admin Dashboard</h1>
      <div className="admin-stats">
        {stats.map((stat) => (
          <div key={stat.label} className="admin-stat-card">
            <div className="admin-stat-value">{stat.value}</div>
            <div className="admin-stat-label">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
