"use client"

import { Lock, Unlock, ArrowRightLeft, Heart } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useState } from "react"
import { playerName } from "@/lib/utils"
import type { Player } from "@/lib/types"

export interface ScenarioPlayer {
  player: Player
  locked: boolean
  source: "returning" | "level_below" | "age_up" | "level_above" | "manual"
  bubble: boolean
}

export function ScenarioPlayerRow({
  scenarioPlayer,
  isInCrew,
  currentTeam,
  availableTeams,
  onMove,
  onToggleLock,
  showDivider,
}: {
  scenarioPlayer: ScenarioPlayer
  isInCrew: boolean
  currentTeam: string | null
  availableTeams: string[]
  onMove: (toTeam: string | null) => void
  onToggleLock: () => void
  showDivider?: boolean
}) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const { player, locked, bubble } = scenarioPlayer
  const fullName = playerName(player.first_name, player.last_name)

  const rowClass = [
    "scenario-player-row",
    isInCrew ? "crew" : "",
    bubble ? "bubble" : "",
    showDivider ? "team-divider" : "",
  ].filter(Boolean).join(" ")

  return (
    <div className={rowClass}>
      <span className="scenario-player-number">#{player.number}</span>
      <span className="scenario-player-name">{fullName || "—"}</span>
      {player.position && (
        <span className="scenario-player-pos">{player.position}</span>
      )}
      {player.previous_team && (
        <span className="scenario-player-prev">{player.previous_team}</span>
      )}
      {isInCrew && (
        <span className="scenario-crew-icon">
          <Heart className="crew-heart-icon" />
        </span>
      )}
      <button className={`scenario-lock-btn${locked ? " locked" : ""}`} onClick={onToggleLock}>
        {locked ? <Lock className="scenario-lock-icon" /> : <Unlock className="scenario-lock-icon" />}
      </button>
      {!locked && (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button className="scenario-move-btn">
              <ArrowRightLeft className="scenario-move-icon" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="scenario-move-popover">
            {availableTeams
              .filter((t) => t !== currentTeam)
              .map((team) => (
                <button
                  key={team}
                  className="scenario-move-option"
                  onClick={() => {
                    onMove(team)
                    setPopoverOpen(false)
                  }}
                >
                  {team}
                </button>
              ))}
            {currentTeam && (
              <button
                className="scenario-move-option scenario-move-unassign"
                onClick={() => {
                  onMove(null)
                  setPopoverOpen(false)
                }}
              >
                Unassigned
              </button>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
