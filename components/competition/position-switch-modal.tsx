"use client"

import { X } from "lucide-react"
import type { Player } from "@/lib/types"
import { playerName } from "@/lib/utils"

export function PositionSwitchModal({
  player,
  originalPosition,
  onConfirm,
  onClose,
}: {
  player: Player
  originalPosition: string
  onConfirm: () => void
  onClose: () => void
}) {
  const currentPos = player.position
  const newPos = currentPos === "F" ? "D" : "F"
  const isReverting = currentPos !== originalPosition

  return (
    <div className="slot-modal-overlay" onClick={onClose}>
      <div className="slot-modal" onClick={(e) => e.stopPropagation()}>
        <div className="slot-modal-header">
          <span className="slot-modal-title">Switch Position</span>
          <button className="slot-modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="slot-modal-body">
          <p className="pos-switch-player">
            {playerName(player.first_name, player.last_name, player.number)} (#{player.number})
          </p>
          <div className="pos-switch-arrow">
            <span className="pos-switch-badge">{currentPos}</span>
            <span className="pos-switch-icon">→</span>
            <span className="pos-switch-badge pos-switch-badge-new">{newPos}</span>
          </div>
          {isReverting && (
            <p className="pos-switch-revert">Restoring original position</p>
          )}
        </div>
        <div className="slot-modal-footer">
          <button className="slot-reset-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="slot-save-btn" onClick={onConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
