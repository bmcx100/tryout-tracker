"use client"

import { X } from "lucide-react"

interface ResetConfirmModalProps {
  title: string
  items: string[]
  onConfirm: () => void
  onCancel: () => void
}

export function ResetConfirmModal({
  title,
  items,
  onConfirm,
  onCancel,
}: ResetConfirmModalProps) {
  return (
    <div className="slot-modal-overlay" onClick={onCancel}>
      <div className="slot-modal" onClick={(e) => e.stopPropagation()}>
        <div className="slot-modal-header">
          <span className="slot-modal-title">{title}</span>
          <button className="slot-modal-close" onClick={onCancel}>
            <X size={16} />
          </button>
        </div>
        <div className="slot-modal-body">
          <p className="reset-modal-desc">This will reset:</p>
          <ul className="reset-modal-items">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="slot-modal-footer">
          <button className="slot-reset-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="reset-modal-confirm" onClick={onConfirm}>
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}
