"use client"

import { Toaster } from "sonner"

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          fontFamily: "var(--font-space-mono)",
          fontSize: "12px",
          borderRadius: "0.5rem",
        },
      }}
    />
  )
}
