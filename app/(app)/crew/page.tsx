"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { CrewMember } from "@/lib/types"
import { CrewGroup } from "@/components/crew/crew-group"
import { CrewDetailSheet } from "@/components/crew/crew-detail-sheet"
import { AddToCrewDialog } from "@/components/crew/add-to-crew-dialog"
import Link from "next/link"

const TAG_ORDER = ["bff", "teammate", "old_teammate", "friend"]

export default function CrewPage() {
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMember, setSelectedMember] = useState<CrewMember | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const fetchCrew = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from("user_crew")
      .select("*, player:players(*)")
      .order("tag")

    if (data) setCrew(data)
    setLoading(false)
  }

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("user_crew")
        .select("*, player:players(*)")
        .order("tag")

      if (data) setCrew(data)
      setLoading(false)
    }
    load()
  }, [])

  const grouped = TAG_ORDER.map((tag) => ({
    tag,
    members: crew.filter((m) => m.tag === tag),
  }))

  const handleMemberClick = (member: CrewMember) => {
    setSelectedMember(member)
    setSheetOpen(true)
  }

  if (loading) {
    return (
      <div className="app-page">
        <div className="app-page-header">
          <h1 className="app-page-title">My Crew</h1>
        </div>
        <div className="app-empty-state">
          <p className="app-empty-desc">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-page">
      <div className="app-page-header">
        <h1 className="app-page-title">My Crew</h1>
        <button className="btn-primary" onClick={() => setAddOpen(true)}>
          Add to Crew
        </button>
      </div>

      {crew.length === 0 ? (
        <div className="app-empty-state">
          <p className="app-empty-title">Your crew is empty</p>
          <p className="app-empty-desc">
            Head to <Link href="/explore" className="crew-link">Explore</Link> to add your kid&apos;s friends and teammates.
          </p>
        </div>
      ) : (
        grouped.map(({ tag, members }) => (
          <CrewGroup
            key={tag}
            tag={tag}
            members={members}
            onMemberClick={handleMemberClick}
          />
        ))
      )}

      <CrewDetailSheet
        member={selectedMember}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={fetchCrew}
      />

      <AddToCrewDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={fetchCrew}
      />
    </div>
  )
}
