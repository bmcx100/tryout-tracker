import { NoiseOverlay } from "@/components/noise-overlay"
import { Hero } from "@/components/hero"
import { StatsBar } from "@/components/stats-bar"
import { FeatureCards } from "@/components/feature-cards"
import { Philosophy } from "@/components/philosophy"
import { Steps } from "@/components/steps"
import { CTASection } from "@/components/cta-section"

export default function Home() {
  return (
    <>
      <NoiseOverlay />
      <main className="main-content">
        <Hero />
        <div className="section-gap">
          <StatsBar />
        </div>
        <div className="section-divider" />
        <div className="section-gap">
          <FeatureCards />
        </div>
        <Philosophy />
        <div className="section-gap">
          <Steps />
        </div>
        <CTASection />
      </main>
    </>
  )
}
