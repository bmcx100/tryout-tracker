import { Activity } from "lucide-react"

export function AppHeader() {
  return (
    <header className="app-header">
      <span className="app-header-brand">TRYOUT TRACKER</span>
      <button className="app-header-action" aria-label="Status">
        <Activity size={18} />
      </button>
    </header>
  )
}
