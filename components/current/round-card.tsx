"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import type { Round, RoundResultRecord, CrewMember } from "@/lib/types"

const RESULT_LABELS: Record<string, string> = {
  advanced: "Advanced",
  cut_down: "Cut Down",
  withdrawn: "Withdrawn",
  placed: "Placed",
}

export function RoundCard({
  round,
  results,
  crewMap,
}: {
  round: Round
  results: RoundResultRecord[]
  crewMap: Map<number, CrewMember>
}) {
  const [expanded, setExpanded] = useState(false)

  const crewResults = results.filter((r) => crewMap.has(r.player_number))
  const otherResults = results.filter((r) => !crewMap.has(r.player_number))

  return (
    <div className="round-card">
      <button
        className="round-card-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="round-card-title-row">
          <span className={`level-badge${round.level === "AA" ? " level-badge-aa" : ""}`}>
            {round.level}
          </span>
          <span className="round-card-name">Round {round.round_number}</span>
          <span className="round-card-date">{round.date}</span>
          <span className="round-card-count">{results.length} results</span>
        </div>
        <ChevronDown className={`team-card-chevron${expanded ? " expanded" : ""}`} />
      </button>
      {expanded && (
        <div className="round-card-results">
          {crewResults.length > 0 && (
            <div className="round-card-crew-section">
              <span className="round-card-section-label">Your Crew</span>
              {crewResults.map((r) => {
                const member = crewMap.get(r.player_number)
                return (
                  <div key={r.id} className="round-result-row crew-highlight">
                    <span className="round-result-number">#{r.player_number}</span>
                    <span className="round-result-name">
                      {member?.personal_name || `#${r.player_number}`}
                    </span>
                    <span className={`round-result-badge result-${r.result}`}>
                      {RESULT_LABELS[r.result] || r.result}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          {otherResults.length > 0 && (
            <div className="round-card-other-section">
              {crewResults.length > 0 && (
                <span className="round-card-section-label">Others</span>
              )}
              {otherResults.map((r) => (
                <div key={r.id} className="round-result-row">
                  <span className="round-result-number">#{r.player_number}</span>
                  <span className="round-result-name" />
                  <span className={`round-result-badge result-${r.result}`}>
                    {RESULT_LABELS[r.result] || r.result}
                  </span>
                </div>
              ))}
            </div>
          )}
          {results.length === 0 && (
            <p className="round-card-empty">No results recorded yet</p>
          )}
        </div>
      )}
    </div>
  )
}
