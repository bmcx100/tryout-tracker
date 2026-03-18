"use client"

import { useScrollReveal } from "@/hooks/use-scroll-reveal"

const stats = [
  { value: "50+", label: "Friends tracked" },
  { value: "5", label: "Levels" },
  { value: "LIVE", label: "Updates" },
  { value: "Private", label: "Always" },
]

export function StatsBar() {
  const ref = useScrollReveal()

  return (
    <div className="stats-bar scroll-reveal" ref={ref}>
      {stats.map((stat, i) => (
        <div key={stat.label} className={`stat-block stagger-${i + 1}`}>
          <div className="stat-value">{stat.value}</div>
          <div className="stat-label">{stat.label}</div>
        </div>
      ))}
    </div>
  )
}
