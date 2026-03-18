"use client"

import { useScrollReveal } from "@/hooks/use-scroll-reveal"

export function Philosophy() {
  const ref = useScrollReveal()

  return (
    <section className="philosophy">
      <div className="philosophy-inner scroll-reveal" ref={ref}>
        <p className="philosophy-common">
          Most parents refresh the league website alone.
        </p>
        <p className="philosophy-different">
          We built for: <span className="philosophy-accent">your crew.</span>
        </p>
      </div>
    </section>
  )
}
