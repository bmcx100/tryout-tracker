import { createClient } from "@/lib/supabase/server"

interface TeamStats {
  total: number
  fullyConfirmed: number
  allCheckedIn: number
}

function computeTeamStats(
  players: { previous_team: string | null, info_confirmed: boolean, checked_in: boolean }[]
): TeamStats {
  const teams = new Map<string, { confirmed: boolean, checkedIn: boolean }>()

  for (const p of players) {
    const team = p.previous_team ?? "Unknown"
    const existing = teams.get(team)
    if (!existing) {
      teams.set(team, { confirmed: p.info_confirmed, checkedIn: p.checked_in })
    } else {
      if (!p.info_confirmed) existing.confirmed = false
      if (!p.checked_in) existing.checkedIn = false
    }
  }

  let fullyConfirmed = 0
  let allCheckedIn = 0
  for (const t of teams.values()) {
    if (t.confirmed) fullyConfirmed++
    if (t.checkedIn) allCheckedIn++
  }

  return { total: teams.size, fullyConfirmed, allCheckedIn }
}

export default async function AdminDashboard() {
  const supabase = await createClient()

  const [
    { count: playerCount },
    { count: confirmedCount },
    { count: checkedInCount },
    { data: teamPlayers },
    { count: userCount },
    { count: pendingUserCount },
  ] = await Promise.all([
    supabase.from("players").select("*", { count: "exact", head: true }),
    supabase.from("players").select("*", { count: "exact", head: true }).eq("info_confirmed", true),
    supabase.from("players").select("*", { count: "exact", head: true }).eq("checked_in", true),
    supabase.from("players").select("previous_team, info_confirmed, checked_in"),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "pending"),
  ])

  const totalPlayers = playerCount ?? 0
  const totalConfirmed = confirmedCount ?? 0
  const totalCheckedIn = checkedInCount ?? 0
  const teamStats = computeTeamStats(teamPlayers ?? [])
  const totalUsers = userCount ?? 0
  const totalPending = pendingUserCount ?? 0
  const totalActive = totalUsers - totalPending

  return (
    <div>
      <h1 className="app-page-title">Admin Dashboard</h1>
      <div className="admin-stats">
        {/* Players Card */}
        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <div className="admin-stat-label">Total Players</div>
            <div className="admin-stat-value">{totalPlayers}</div>
          </div>
          <div className="admin-stat-substats">
            <div className="admin-progress-row">
              <div className="admin-progress-label">
                <span>Info Confirmed</span>
                <span>{totalConfirmed}/{totalPlayers}</span>
              </div>
              <div className="admin-progress">
                <div
                  className="admin-progress-fill"
                  style={{ width: totalPlayers > 0 ? `${(totalConfirmed / totalPlayers) * 100}%` : "0%" }}
                />
              </div>
            </div>
            <div className="admin-progress-row">
              <div className="admin-progress-label">
                <span>Checked In</span>
                <span>{totalCheckedIn}/{totalPlayers}</span>
              </div>
              <div className="admin-progress">
                <div
                  className="admin-progress-fill admin-progress-fill--alert"
                  style={{ width: totalPlayers > 0 ? `${(totalCheckedIn / totalPlayers) * 100}%` : "0%" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Teams Card */}
        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <div className="admin-stat-label">Teams</div>
            <div className="admin-stat-value">{teamStats.total}</div>
          </div>
          <div className="admin-stat-substats">
            <div className="admin-progress-row">
              <div className="admin-progress-label">
                <span>Fully Confirmed</span>
                <span>{teamStats.fullyConfirmed}/{teamStats.total}</span>
              </div>
              <div className="admin-progress">
                <div
                  className="admin-progress-fill"
                  style={{ width: teamStats.total > 0 ? `${(teamStats.fullyConfirmed / teamStats.total) * 100}%` : "0%" }}
                />
              </div>
            </div>
            <div className="admin-progress-row">
              <div className="admin-progress-label">
                <span>All Checked In</span>
                <span>{teamStats.allCheckedIn}/{teamStats.total}</span>
              </div>
              <div className="admin-progress">
                <div
                  className="admin-progress-fill admin-progress-fill--alert"
                  style={{ width: teamStats.total > 0 ? `${(teamStats.allCheckedIn / teamStats.total) * 100}%` : "0%" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sessions Card — placeholder, implemented in Task 4 */}

        {/* Users Card */}
        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <div className="admin-stat-label">Users</div>
            <div className="admin-stat-value">{totalUsers}</div>
          </div>
          <div className="admin-stat-substats">
            <div className="admin-stat-row">
              <span>Active</span>
              <span>{totalActive}</span>
            </div>
            <div className="admin-stat-row admin-stat-row--alert">
              <span>Pending Approval</span>
              <span>{totalPending}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
