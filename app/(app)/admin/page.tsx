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

interface SessionStats {
  missingResults: number
  upcoming: number
  completed: number
}

function computeSessionStats(
  sessions: { level: string, round_number: number, date: string }[],
  rounds: { level: string, round_number: number, hasResults: boolean }[]
): SessionStats {
  const today = new Date().toISOString().split("T")[0]
  const roundMap = new Map<string, boolean>()
  for (const r of rounds) {
    roundMap.set(`${r.level}-${r.round_number}`, r.hasResults)
  }

  let missingResults = 0
  let upcoming = 0
  let completed = 0

  for (const s of sessions) {
    if (s.date >= today) {
      upcoming++
    } else {
      const key = `${s.level}-${s.round_number}`
      if (roundMap.get(key)) {
        completed++
      } else {
        missingResults++
      }
    }
  }

  return { missingResults, upcoming, completed }
}

export default async function AdminDashboard() {
  const supabase = await createClient()

  const [
    { count: playerCount },
    { count: confirmedCount },
    { count: checkedInCount },
    { data: teamPlayers },
    { data: sessions },
    { data: rounds },
    { count: userCount },
    { count: pendingUserCount },
  ] = await Promise.all([
    supabase.from("players").select("*", { count: "exact", head: true }),
    supabase.from("players").select("*", { count: "exact", head: true }).eq("info_confirmed", true),
    supabase.from("players").select("*", { count: "exact", head: true }).eq("checked_in", true),
    supabase.from("players").select("previous_team, info_confirmed, checked_in"),
    supabase.from("sessions").select("level, round_number, date"),
    supabase.from("rounds").select("level, round_number, round_results(id)"),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "pending"),
  ])

  const totalPlayers = playerCount ?? 0
  const totalConfirmed = confirmedCount ?? 0
  const totalCheckedIn = checkedInCount ?? 0
  const teamStats = computeTeamStats(teamPlayers ?? [])
  const roundsWithResults = (rounds ?? []).map((r: { level: string, round_number: number, round_results: { id: string }[] }) => ({
    level: r.level,
    round_number: r.round_number,
    hasResults: r.round_results.length > 0,
  }))
  const sessionStats = computeSessionStats(sessions ?? [], roundsWithResults)
  const totalUsers = userCount ?? 0
  const totalPending = pendingUserCount ?? 0
  const totalActive = totalUsers - totalPending

  return (
    <div>
      <h1 className="app-page-title">Dashboard</h1>
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

        {/* Sessions Card */}
        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <div className="admin-stat-label">Active Sessions</div>
            <div className="admin-stat-value">{sessionStats.missingResults + sessionStats.upcoming}</div>
          </div>
          <div className="admin-stat-substats">
            <div className="admin-stat-row admin-stat-row--alert">
              <span>Missing Results</span>
              <span>{sessionStats.missingResults}</span>
            </div>
            <div className="admin-stat-row">
              <span>Upcoming</span>
              <span>{sessionStats.upcoming}</span>
            </div>
            <div className="admin-stat-row admin-stat-divider">
              <span>Completed</span>
              <span>{sessionStats.completed}</span>
            </div>
          </div>
        </div>

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
