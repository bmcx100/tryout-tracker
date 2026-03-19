"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { ChevronDown } from "lucide-react"
import { ScenarioTeamCard } from "./scenario-team-card"
import { ScenarioPlayerRow, type ScenarioPlayer } from "./scenario-player-row"
import { ScenarioToolbar, type ScenarioSummary } from "./scenario-toolbar"
import {
  buildScenario,
  shouldLockOnMove,
  serializeScenario,
  rehydrateScenario,
  type ScenarioTeam,
} from "@/lib/scenario-utils"
import {
  listScenarios,
  loadScenario,
  saveScenario,
  updateScenario,
  deleteScenario,
  toggleSharedScenario,
} from "@/lib/actions/scenarios"
import { toast } from "sonner"
import type { Player, CrewMember } from "@/lib/types"

export function ScenarioBuilder({
  players,
  crewMap,
}: {
  players: Player[]
  crewMap: Map<number, CrewMember>
}) {
  const [generation, setGeneration] = useState(0)
  const hasManualChanges = useRef(false)

  const initial = useMemo(() => {
    return buildScenario(players)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, generation])

  const [teams, setTeams] = useState<ScenarioTeam[]>(initial.teams)
  const [unassigned, setUnassigned] = useState<Player[]>(initial.unassigned)
  const [completedTeams, setCompletedTeams] = useState<Set<string>>(new Set())
  const completedSnapshots = useRef<Map<string, { teams: ScenarioTeam[]; unassigned: Player[] }>>(new Map())

  // Scenario persistence state
  const [savedScenarios, setSavedScenarios] = useState<ScenarioSummary[]>([])
  const [activeScenarioId, setActiveScenarioId] = useState("__fresh_build__")
  const [description, setDescription] = useState("")
  const [descExpanded, setDescExpanded] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const prevGenRef = useRef({ players, generation })
  if (
    prevGenRef.current.players !== players ||
    prevGenRef.current.generation !== generation
  ) {
    prevGenRef.current = { players, generation }
    setTeams(initial.teams)
    setUnassigned(initial.unassigned)
    setCompletedTeams(new Set())
    completedSnapshots.current = new Map()
    hasManualChanges.current = false
    setDescription("")
    setDescExpanded(false)
    setIsDirty(false)
  }

  // Load saved scenario list on mount
  useEffect(() => {
    const load = async () => {
      try {
        const list = await listScenarios()
        setSavedScenarios(list)
      } catch {
        // Not authenticated or table doesn't exist yet
      }
    }
    load()
  }, [])

  const markDirty = () => {
    hasManualChanges.current = true
    setIsDirty(true)
  }

  const handleReset = () => {
    if (hasManualChanges.current) {
      if (!window.confirm("Reset will discard your changes. Continue?")) return
    }
    setGeneration((g) => g + 1)
  }

  const handleSelectScenario = async (id: string) => {
    if (isDirty) {
      if (!window.confirm("You have unsaved changes. Discard and switch?")) return
    }

    if (id === "__fresh_build__") {
      setActiveScenarioId(id)
      setDescription("")
      setDescExpanded(false)
      setGeneration((g) => g + 1)
      return
    }

    // Load from DB
    try {
      const scenario = await loadScenario(id)
      const hydrated = rehydrateScenario(scenario.scenario_data, players)
      setTeams(hydrated.teams)
      setUnassigned(hydrated.unassigned)
      setCompletedTeams(hydrated.completedTeams)
      completedSnapshots.current = new Map()
      hasManualChanges.current = false
      setActiveScenarioId(id)
      setDescription(scenario.description || "")
      setDescExpanded(!!(scenario.description))
      setIsDirty(false)
    } catch {
      // Failed to load
    }
  }

  const handleSave = async () => {
    if (activeScenarioId.startsWith("__")) return
    const payload = serializeScenario(teams, unassigned, completedTeams)
    await updateScenario(activeScenarioId, { scenario_data: payload, description })
    setIsDirty(false)
    hasManualChanges.current = false
  }

  const handleSaveAs = async (name: string) => {
    const payload = serializeScenario(teams, unassigned, completedTeams)
    try {
      await saveScenario({ name, description, scenario_data: payload })
      const list = await listScenarios()
      setSavedScenarios(list)
      const newest = list.find((s) => s.name === name)
      if (newest) {
        setActiveScenarioId(newest.id)
      }
      setIsDirty(false)
      hasManualChanges.current = false
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save scenario")
    }
  }

  const handleDeleteScenario = async () => {
    if (!window.confirm("Delete this scenario?")) return
    await deleteScenario(activeScenarioId)
    const list = await listScenarios()
    setSavedScenarios(list)
    setActiveScenarioId("__fresh_build__")
    setGeneration((g) => g + 1)
  }

  const handleToggleShared = async (id: string, shared: boolean) => {
    await toggleSharedScenario(id, shared)
    const list = await listScenarios()
    setSavedScenarios(list)
  }

  const availableTeams = teams.map((t) => t.teamName)

  const handleMovePlayer = (playerNumber: number, fromTeam: string | null, toTeam: string | null) => {
    markDirty()
    setTeams((prev) => {
      const next = prev.map((t) => ({ ...t, roster: [...t.roster] }))

      let movedPlayer: ScenarioPlayer | null = null
      if (fromTeam) {
        const sourceTeam = next.find((t) => t.teamName === fromTeam)
        if (sourceTeam) {
          const idx = sourceTeam.roster.findIndex((sp) => sp.player.number === playerNumber)
          if (idx >= 0) {
            movedPlayer = { ...sourceTeam.roster[idx], source: "manual", priority: 99 }
            sourceTeam.roster.splice(idx, 1)
          }
        }
      } else {
        const player = unassigned.find((p) => p.number === playerNumber)
        if (player) {
          movedPlayer = { player, locked: false, source: "manual", bubble: false, priority: 99 }
          setUnassigned((prev) => prev.filter((p) => p.number !== playerNumber))
        }
      }

      if (movedPlayer && toTeam) {
        const destTeam = next.find((t) => t.teamName === toTeam)
        if (destTeam) {
          const locked = shouldLockOnMove(movedPlayer.player, destTeam.level)
          destTeam.roster.push({
            ...movedPlayer,
            locked,
            bubble: !locked,
          })
        }
      } else if (movedPlayer && !toTeam) {
        setUnassigned((prev) => [...prev, movedPlayer!.player])
      }

      return next
    })
  }

  const handleCompleteTeam = (teamName: string) => {
    markDirty()

    if (completedTeams.has(teamName)) {
      const snapshot = completedSnapshots.current.get(teamName)
      if (snapshot) {
        setTeams(snapshot.teams)
        setUnassigned(snapshot.unassigned)
        completedSnapshots.current.delete(teamName)
      }
      setCompletedTeams((prev) => {
        const next = new Set(prev)
        next.delete(teamName)
        return next
      })
      return
    }

    completedSnapshots.current.set(teamName, {
      teams: teams.map((t) => ({ ...t, roster: [...t.roster] })),
      unassigned: [...unassigned],
    })

    setTeams((prev) => {
      const next = prev.map((t) => ({ ...t, roster: [...t.roster] }))
      const teamIdx = next.findIndex((t) => t.teamName === teamName)
      if (teamIdx < 0) return prev

      const team = next[teamIdx]
      const unlocked = team.roster.filter((sp) => !sp.locked)
      team.roster = team.roster.filter((sp) => sp.locked)

      const nextTeam = teamIdx + 1 < next.length ? next[teamIdx + 1] : null

      if (nextTeam) {
        for (const sp of unlocked) {
          const locked = shouldLockOnMove(sp.player, nextTeam.level)
          nextTeam.roster.push({ ...sp, locked, bubble: !locked, source: "manual", priority: 99 })
        }
      } else {
        setUnassigned((prev) => [...prev, ...unlocked.map((sp) => sp.player)])
      }

      return next
    })
    setCompletedTeams((prev) => new Set([...prev, teamName]))
  }

  const handleToggleLock = (playerNumber: number, teamName: string) => {
    markDirty()
    setTeams((prev) =>
      prev.map((t) => {
        if (t.teamName !== teamName) return t
        return {
          ...t,
          roster: t.roster.map((sp) =>
            sp.player.number === playerNumber ? { ...sp, locked: !sp.locked } : sp
          ),
        }
      })
    )
  }

  return (
    <div className="scenario-builder">
      <ScenarioToolbar
        activeScenarioId={activeScenarioId}
        savedScenarios={savedScenarios}
        isDirty={isDirty}
        onSelectScenario={handleSelectScenario}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onDelete={handleDeleteScenario}
        onReset={handleReset}
        onToggleShared={handleToggleShared}
      />

      <div className="scenario-description-panel">
        <button
          className="scenario-description-toggle"
          onClick={() => setDescExpanded(!descExpanded)}
        >
          <span className="scenario-description-toggle-label">Notes</span>
          <ChevronDown className={`scenario-description-chevron${descExpanded ? " expanded" : ""}`} />
        </button>
        {descExpanded && (
          <textarea
            className="scenario-description-input"
            placeholder="Add notes about this scenario..."
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              markDirty()
            }}
            rows={3}
          />
        )}
      </div>

      <div className="scenario-teams">
        {teams.map((team) => (
          <ScenarioTeamCard
            key={team.teamName}
            teamName={team.teamName}
            roster={team.roster}
            crewMap={crewMap}
            availableTeams={availableTeams}
            onMovePlayer={(playerNumber, toTeam) =>
              handleMovePlayer(playerNumber, team.teamName, toTeam)
            }
            onToggleLock={(playerNumber) => handleToggleLock(playerNumber, team.teamName)}
            onComplete={() => handleCompleteTeam(team.teamName)}
            isComplete={completedTeams.has(team.teamName)}
            defaultExpanded={team.level === "AA"}
          />
        ))}
      </div>

      {unassigned.length > 0 && (
        <div className="scenario-unassigned">
          <h3 className="scenario-unassigned-title">
            Unassigned ({unassigned.length})
          </h3>
          <div className="scenario-unassigned-list">
            {unassigned.map((player) => (
              <ScenarioPlayerRow
                key={player.id}
                scenarioPlayer={{ player, locked: false, source: "manual", bubble: false, priority: 99 }}
                isInCrew={crewMap.has(player.number)}
                currentTeam={null}
                availableTeams={availableTeams}
                onMove={(toTeam) => {
                  if (toTeam) {
                    handleMovePlayer(player.number, null, toTeam)
                  }
                }}
                onToggleLock={() => {}}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
