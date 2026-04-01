import { AppSidebar } from "@/components/app-sidebar"
import { AppTabBar } from "@/components/app-tab-bar"
import { AppHeaderAuth } from "@/components/app-header-auth"

// Auth + role checks are handled by middleware — no need to duplicate here.
// Middleware already redirects unauthenticated → /login and pending → /pending.

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <AppSidebar />
      <AppHeaderAuth />
      <main className="app-main">
        {children}
      </main>
      <AppTabBar />
    </>
  )
}
