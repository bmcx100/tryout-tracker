"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { togglePlayerConfirmation, bulkConfirmTeam } from "@/lib/actions/teams"
import { getAgeGroup, PREVIOUS_TEAMS, AGE_GROUPS, playerName } from "@/lib/utils"
import type { Player } from "@/lib/types"
import type { AgeGroup } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type AgeFilter = AgeGroup | "all"

export default function AdminTeamsPage() {
  const { activeOrgId } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [ageFilter, setAgeFilter] = useState<AgeFilter>("all")

  const fetchPlayers = async () => {
    if (!activeOrgId) return
    const supabase = createClient()
    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("org_id", activeOrgId)
      .order("number")
    if (data) setPlayers(data)
  }

  useEffect(() => {
    if (!activeOrgId) return
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("players")
        .select("*")
        .eq("org_id", activeOrgId)
        .order("number")
      if (data) setPlayers(data)
    }
    load()
  }, [activeOrgId])

  const previousTeams = ageFilter === "all"
    ? [...PREVIOUS_TEAMS.U15, ...PREVIOUS_TEAMS.U13]
    : PREVIOUS_TEAMS[ageFilter]

  const teamGroups = previousTeams.map((team) => ({
    name: team,
    players: players.filter((p) => p.previous_team === team),
  }))

  const handleToggle = async (playerId: string, field: "info_confirmed" | "checked_in", value: boolean) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, [field]: value } : p))
    )
    try {
      await togglePlayerConfirmation(playerId, field, value)
    } catch {
      fetchPlayers()
    }
  }

  const handleBulkConfirm = async (teamPlayers: Player[], field: "info_confirmed" | "checked_in") => {
    const allConfirmed = teamPlayers.every((p) => p[field])
    const value = !allConfirmed
    const ids = teamPlayers.map((p) => p.id)

    setPlayers((prev) =>
      prev.map((p) => (ids.includes(p.id) ? { ...p, [field]: value } : p))
    )
    try {
      await bulkConfirmTeam(ids, field, value)
    } catch {
      fetchPlayers()
    }
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="app-page-title">Teams</h1>
      </div>

      <div className="feed-filters">
        <button
          className={`feed-filter-btn${ageFilter === "all" ? " active" : ""}`}
          onClick={() => setAgeFilter("all")}
        >
          All
        </button>
        {AGE_GROUPS.map((g) => (
          <button
            key={g}
            className={`feed-filter-btn${ageFilter === g ? " active" : ""}`}
            onClick={() => setAgeFilter(g)}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="admin-teams-list">
        {teamGroups.map((group) => {
          if (group.players.length === 0) return null
          const infoCount = group.players.filter((p) => p.info_confirmed).length
          const checkedCount = group.players.filter((p) => p.checked_in).length
          const total = group.players.length
          const allInfo = infoCount === total
          const allChecked = checkedCount === total

          return (
            <div key={group.name} className="admin-team-card">
              <div className="admin-team-header">
                <div className="admin-team-title-row">
                  <h2 className="admin-team-name">{group.name}</h2>
                  <span className="admin-team-count">{total} players</span>
                </div>
                <div className="admin-team-progress-row">
                  <span className={`admin-team-progress${allInfo ? " complete" : ""}`}>
                    Info: {infoCount}/{total}
                  </span>
                  <span className={`admin-team-progress${allChecked ? " complete" : ""}`}>
                    Checked In: {checkedCount}/{total}
                  </span>
                </div>
                <div className="admin-team-bulk-actions">
                  <button
                    className={`admin-action-btn${allInfo ? " admin-action-danger" : ""}`}
                    onClick={() => handleBulkConfirm(group.players, "info_confirmed")}
                  >
                    {allInfo ? "Unconfirm All Info" : "Confirm All Info"}
                  </button>
                  <button
                    className={`admin-action-btn${allChecked ? " admin-action-danger" : ""}`}
                    onClick={() => handleBulkConfirm(group.players, "checked_in")}
                  >
                    {allChecked ? "Uncheck All In" : "Check All In"}
                  </button>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Pos</TableHead>
                    <TableHead>Info</TableHead>
                    <TableHead>Checked In</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.players.map((player) => (
                    <TableRow key={player.id}>
                      <TableCell className="admin-cell-number">{player.number}</TableCell>
                      <TableCell>{playerName(player.first_name, player.last_name)}</TableCell>
                      <TableCell>{player.position || "—"}</TableCell>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="admin-confirm-checkbox"
                          checked={player.info_confirmed}
                          onChange={() => handleToggle(player.id, "info_confirmed", !player.info_confirmed)}
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="admin-confirm-checkbox"
                          checked={player.checked_in}
                          onChange={() => handleToggle(player.id, "checked_in", !player.checked_in)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        })}
        {teamGroups.every((g) => g.players.length === 0) && (
          <div className="admin-empty-cell">No players found</div>
        )}
      </div>
    </div>
  )
}
