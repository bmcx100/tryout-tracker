"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { RotateCcw, CircleHelp } from "lucide-react"
import { TeamTierList } from "@/components/competition/team-tier-list"
import type { Player, PinnedPlayer, PositionGroup } from "@/lib/types"

interface StepRankTeamsProps {
  teamOrder: string[]
  playersByTeam: Record<string, Player[]>
  allPlayers: Player[]
  playerOrderMap: Record<string, number[]>
  pinnedPlayers: Record<string, PinnedPlayer>
  crewNumbers: Set<number>
  positionFilter: "F" | "D" | "G" | "ALL"
  positionOverrides: Record<string, string>
  onTeamReorder: (newOrder: string[]) => void
  onPlayerReorder: (team: string, playerNumbers: number[]) => void
  onPinToTeam: (playerNumber: number, targetTeam: string, pos: number) => void
  onReset: () => void
  onNext: () => void
  onPositionOverride: (playerNumber: number, newPosition: string | null) => void
}

export function StepRankTeams({
  teamOrder,
  playersByTeam,
  allPlayers,
  playerOrderMap,
  pinnedPlayers,
  crewNumbers,
  positionFilter,
  positionOverrides,
  onTeamReorder,
  onPlayerReorder,
  onPinToTeam,
  onReset,
  onNext,
  onPositionOverride,
}: StepRankTeamsProps) {
  const [replayKey, setReplayKey] = useState(0)
  const [pulsing, setPulsing] = useState(false)
  const hasMoved = useRef(false)
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    pulseTimer.current = setTimeout(() => {
      if (!hasMoved.current) setPulsing(true)
    }, 5000)
    return () => {
      if (pulseTimer.current) clearTimeout(pulseTimer.current)
    }
  }, [])

  const handleTeamReorder = useCallback((newOrder: string[]) => {
    hasMoved.current = true
    setPulsing(false)
    onTeamReorder(newOrder)
  }, [onTeamReorder])

  const handleReplay = useCallback(() => {
    setPulsing(false)
    setReplayKey((k) => k + 1)
  }, [])

  return (
    <div className="wizard-container">
      <div className="wizard-step-row">
        <span className="wizard-step-label">Step 1 of 2</span>
      </div>
      <h1 className="wizard-headline">Rank Existing Teams</h1>
      <div className="wizard-title-divider" />

      <div className="comp-content">
        <TeamTierList
          teamOrder={teamOrder}
          playersByTeam={playersByTeam}
          allPlayers={allPlayers}
          playerOrderMap={playerOrderMap}
          pinnedPlayers={pinnedPlayers}
          crewNumbers={crewNumbers}
          positionFilter={positionFilter}
          positionOverrides={positionOverrides}
          onTeamReorder={handleTeamReorder}
          onPlayerReorder={onPlayerReorder}
          onPinToTeam={onPinToTeam}
          onPositionOverride={onPositionOverride}
          mode="teams"
          replayDemoKey={replayKey}
        />
      </div>

      <div className="wizard-bottom-actions">
        <button className="btn-primary-icon" onClick={onNext}>
          Next Step — Rank Players
        </button>
        <div className="results-reset-group">
          <button className="comp-reset-btn" onClick={onReset} title="Reset team order">
            <RotateCcw size={16} />
            <span className="comp-reset-label">Reset</span>
          </button>
        </div>
      </div>

      <div className="wizard-footer-instructions">
        <p className="wizard-instruction-inline">
          Drag teams to rank them. Best at top. Age groups can mix.{" "}
          <span className="nowrap">You&apos;ll rank players next.</span>
        </p>
        <button
          className={`demo-help-btn${pulsing ? " demo-help-pulse" : ""}`}
          onClick={handleReplay}
        >
          <CircleHelp size={14} />
        </button>
      </div>
    </div>
  )
}
