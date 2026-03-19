"use client"

import Link from "next/link"
import { useScrollReveal } from "@/hooks/use-scroll-reveal"

export function CTASection() {
  const ref = useScrollReveal()

  return (
    <section className="cta-section">
      <div className="cta-content scroll-reveal" ref={ref}>
        <h2 className="cta-headline">See where your crew lands.</h2>
        <p className="cta-body">
          Track your BFFs, teammates, and friends through every round.
        </p>
        <Link href="/login" className="cta-button">Start Tracking Your Crew</Link>
        <p className="cta-note">Free for all tryout families.</p>
      </div>
    </section>
  )
}
