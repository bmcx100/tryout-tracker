"use client"

import { useEffect, useRef } from "react"

export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number = 30000
) {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") {
        savedCallback.current()
      }
    }

    const id = setInterval(tick, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
}
