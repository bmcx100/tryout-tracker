import { NoiseOverlay } from "@/components/noise-overlay"
import { AppHeader } from "@/components/app-header"
import { SidebarNav } from "@/components/sidebar-nav"
import { Hero } from "@/components/hero"
import { StatsBar } from "@/components/stats-bar"
import { FeatureCards } from "@/components/feature-cards"
import { Philosophy } from "@/components/philosophy"
import { Steps } from "@/components/steps"
import { CTASection } from "@/components/cta-section"
import { BottomTabBar } from "@/components/bottom-tab-bar"

export default function Home() {
  return (
    <>
      <NoiseOverlay />
      <SidebarNav />
      <AppHeader />
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
      <BottomTabBar />
    </>
  )
}
