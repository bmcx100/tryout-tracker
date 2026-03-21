"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import type { Correction } from "@/lib/types"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function AdminCorrectionsPage() {
  const { loading: authLoading } = useAuth()
  const [corrections, setCorrections] = useState<Correction[]>([])

  const supabase = createClient()

  useEffect(() => {
    if (authLoading) return
    const fetch = async () => {
      const { data } = await supabase
        .from("corrections")
        .select("*")
        .order("status")
      if (data) setCorrections(data)
    }
    fetch()
  }, [authLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleResolve = async (id: string, status: "approved" | "rejected") => {
    await supabase
      .from("corrections")
      .update({ status })
      .eq("id", id)

    setCorrections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status } : c))
    )
  }

  return (
    <div>
      <h1 className="app-page-title">Corrections</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Field</TableHead>
            <TableHead>Current</TableHead>
            <TableHead>Suggested</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {corrections.map((c) => (
            <TableRow key={c.id}>
              <TableCell>{c.player_number ? `#${c.player_number}` : "—"}</TableCell>
              <TableCell>{c.entity_type}</TableCell>
              <TableCell>{c.field}</TableCell>
              <TableCell>{c.current_value}</TableCell>
              <TableCell>{c.suggested_value}</TableCell>
              <TableCell>
                <span className={`status-badge status-${c.status === "pending" ? "active" : c.status === "approved" ? "placed" : "cut"}`}>
                  {c.status}
                </span>
              </TableCell>
              <TableCell>
                {c.status === "pending" && (
                  <div className="admin-actions">
                    <button className="admin-action-btn" onClick={() => handleResolve(c.id, "approved")}>Approve</button>
                    <button className="admin-action-btn admin-action-danger" onClick={() => handleResolve(c.id, "rejected")}>Reject</button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
          {corrections.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="admin-empty-cell">No corrections submitted</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
