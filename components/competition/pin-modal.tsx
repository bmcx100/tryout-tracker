"use client"

import { useState } from "react"
import { X, ChevronDown } from "lucide-react"
import type { Player } from "@/lib/types"
import { playerName } from "@/lib/utils"

interface PinModalProps {
  player: Player
  teamOrder: string[]
  playersByTeam: Record<string, Player[]>
  onConfirm: (targetTeam: string, position: number) => void
  onCancel: () => void
}

function formatTeamCode(code: string): string {
  const match = code.match(/^(U\d+)(AA|A|BB|B|C)$/)
  if (!match) return code
  return `${match[1]} ${match[2]}`
}

export function PinModal({
  player,
  teamOrder,
  playersByTeam,
  onConfirm,
  onCancel,
}: PinModalProps) {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [selectedPosition, setSelectedPosition] = useState<number>(0)
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)

  const name = playerName(player.first_name, player.last_name, player.number)
  const availableTeams = teamOrder.filter((t) => t !== player.previous_team)

  return (
    <div className="comp-pin-overlay" onClick={onCancel}>
      <div className="comp-pin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="comp-pin-header">
          <span className="comp-pin-title">
            Pin #{player.number} {name}
          </span>
          <button className="comp-pin-close" onClick={onCancel}>
            <X size={16} />
          </button>
        </div>
        <p className="comp-pin-desc">
          Select a team and position to place this player
        </p>
        <div className="comp-pin-teams">
          {availableTeams.map((teamCode) => {
            const teamPlayers = playersByTeam[teamCode] || []
            const isExpanded = expandedTeam === teamCode
            return (
              <div key={teamCode} className="comp-pin-team-group">
                <button
                  className={`comp-pin-team-btn${selectedTeam === teamCode ? " comp-pin-team-selected" : ""}`}
                  onClick={() => {
                    setSelectedTeam(teamCode)
                    setExpandedTeam(isExpanded ? null : teamCode)
                    setSelectedPosition(0)
                  }}
                >
                  <span>{formatTeamCode(teamCode)}</span>
                  <span className="comp-pin-team-count">{teamPlayers.length}</span>
                  <ChevronDown
                    size={14}
                    className={isExpanded ? "comp-pin-chevron-open" : ""}
                  />
                </button>
                {isExpanded && selectedTeam === teamCode && (
                  <div className="comp-pin-slots">
                    {/* Position 0 = top of list */}
                    <button
                      className={`comp-pin-slot${selectedPosition === 0 ? " comp-pin-slot-active" : ""}`}
                      onClick={() => setSelectedPosition(0)}
                    >
                      Top of list
                    </button>
                    {teamPlayers.map((tp, idx) => (
                      <button
                        key={tp.number}
                        className={`comp-pin-slot${selectedPosition === idx + 1 ? " comp-pin-slot-active" : ""}`}
                        onClick={() => setSelectedPosition(idx + 1)}
                      >
                        After #{tp.number} {playerName(tp.first_name, tp.last_name)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="comp-pin-actions">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!selectedTeam}
            onClick={() => selectedTeam && onConfirm(selectedTeam, selectedPosition)}
          >
            Pin Player
          </button>
        </div>
      </div>
    </div>
  )
}
