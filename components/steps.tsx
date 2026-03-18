"use client"

import { useScrollReveal } from "@/hooks/use-scroll-reveal"

const STEPS = [
  {
    number: "01",
    title: "Add Your Crew",
    desc: "Find your kid's BFFs, current teammates, and old teammates by number. Name them so you always know who's who.",
    geometric: "line",
  },
  {
    number: "02",
    title: "Follow Their Journey",
    desc: "Get live updates as your crew advances, moves levels, or gets placed. Every round, every cut — for your people.",
    geometric: "dots",
  },
  {
    number: "03",
    title: "See Where Everyone Lands",
    desc: "Watch where your crew ends up across AA through C. Know which friends made the same team before anyone else.",
    geometric: "circle",
  },
]

function GeometricElement({ type }: { type: string }) {
  if (type === "line") {
    return (
      <div className="step-geometric">
        <div className="geo-rotating-line" />
      </div>
    )
  }

  if (type === "dots") {
    return (
      <div className="step-geometric">
        <div className="geo-dot-grid">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="geo-dot" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="step-geometric">
      <div className="geo-pulse-circle" />
    </div>
  )
}

export function Steps() {
  const ref = useScrollReveal()

  return (
    <div className="steps-section scroll-reveal" ref={ref}>
      {STEPS.map((step) => (
        <div key={step.number} className="step-card">
          <div className="step-card-text">
            <div className="step-number">{step.number}</div>
            <h3 className="step-title">{step.title}</h3>
            <p className="step-desc">{step.desc}</p>
          </div>
          <GeometricElement type={step.geometric} />
        </div>
      ))}
    </div>
  )
}
