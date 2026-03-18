"use client"

import { useEffect, useState, useRef } from "react"
import { useScrollReveal } from "@/hooks/use-scroll-reveal"

function CrewStatus() {
  const rows = [
    { number: "#47", name: "CONNOR", status: "AA — Round 2" },
    { number: "#23", name: "MARCUS", status: "A — Placed" },
    { number: "#91", name: "TYLER", status: "BB — Active" },
  ]

  return (
    <div className="feature-card">
      <div className="status-board-header">
        <div className="status-live-dot" />
        <span className="status-live-label">My Crew</span>
      </div>
      {rows.map((row) => (
        <div key={row.number} className="status-row">
          <span className="status-row-label">{row.number} {row.name}</span>
          <span className="status-row-value">{row.status}</span>
        </div>
      ))}
    </div>
  )
}

const LOG_LINES = [
  { time: "09:41", text: "#47 ADVANCED — AA ROUND 2" },
  { time: "09:42", text: "#23 PLACED ON A TEAM" },
  { time: "09:43", text: "#91 MOVED TO BB TRYOUT" },
  { time: "09:44", text: "#47 SESSION 3 — RINK B ICE 2" },
  { time: "09:45", text: "#23 FINAL ROSTER CONFIRMED" },
  { time: "09:46", text: "#91 BB ROUND 1 — GROUP 2" },
]

function CrewFeed() {
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleCount((prev) => {
        if (prev >= LOG_LINES.length) return prev
        return prev + 1
      })
    }, 800)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="feature-card">
      <div className="status-board-header">
        <div className="status-live-dot" />
        <span className="status-live-label">Crew Feed</span>
      </div>
      <div className="log-feed-container">
        {LOG_LINES.slice(0, visibleCount).map((line, i) => (
          <div key={i} className="log-line log-line-enter">
            <span className="log-timestamp">[{line.time}]</span>
            <span className="log-text">{line.text}</span>
          </div>
        ))}
        {visibleCount < LOG_LINES.length && <div className="log-cursor" />}
      </div>
    </div>
  )
}

function CrewSpread() {
  const ref = useRef<HTMLDivElement>(null)
  const [animated, setAnimated] = useState(false)

  const crewInAA = 3
  const totalCrew = 8
  const percentage = (crewInAA / totalCrew) * 100
  const radius = 55
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimated(true)
          observer.unobserve(element)
        }
      },
      { threshold: 0.2 }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="feature-card" ref={ref}>
      <div className="status-board-header">
        <div className="status-live-dot" />
        <span className="status-live-label">Crew Spread</span>
      </div>
      <div className="metric-ring-wrap">
        <svg className="metric-ring-svg" viewBox="0 0 120 120">
          <circle className="metric-ring-track" cx="60" cy="60" r={radius} />
          <circle
            className="metric-ring-fill"
            cx="60"
            cy="60"
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={animated ? offset : circumference}
          />
        </svg>
        <div className="metric-ring-center">
          <span className="metric-ring-value">{crewInAA}/{totalCrew}</span>
          <span className="metric-ring-label">Crew in AA</span>
        </div>
      </div>
    </div>
  )
}

export function FeatureCards() {
  const ref = useScrollReveal()

  return (
    <div className="feature-cards scroll-reveal" ref={ref}>
      <CrewStatus />
      <CrewFeed />
      <CrewSpread />
    </div>
  )
}
