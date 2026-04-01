"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { createOrganization } from "@/lib/actions/organizations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import type { Organization } from "@/lib/types"

export default function OrganizationsPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")

  useEffect(() => {
    if (!profile?.is_super_admin) return
    const supabase = createClient()
    const fetchOrgs = async () => {
      const { data } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: false })
      setOrgs(data || [])
    }
    fetchOrgs()
  }, [profile])

  if (!profile?.is_super_admin) {
    return <p>Super admin access required.</p>
  }

  const handleCreate = async () => {
    if (!name || !slug) return
    try {
      await createOrganization({ name, slug: slug.toLowerCase().replace(/\s+/g, "-") })
      setName("")
      setSlug("")
      toast({ title: "Organization created" })
      const supabase = createClient()
      const { data } = await supabase.from("organizations").select("*").order("created_at", { ascending: false })
      setOrgs(data || [])
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" })
    }
  }

  const handleNameChange = (value: string) => {
    setName(value)
    setSlug(value.toLowerCase().replace(/\s+/g, "-"))
  }

  return (
    <div>
      <h1 className="app-page-title">Organizations</h1>

      <div className="admin-section">
        <h2 className="admin-section-title">Create Organization</h2>
        <div className="admin-form-row">
          <Input
            placeholder="Organization name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
          />
          <Input
            placeholder="slug (auto-generated)"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <Button onClick={handleCreate}>Create</Button>
        </div>
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">All Organizations</h2>
        {orgs.map((org) => (
          <div key={org.id} className="admin-card">
            <strong>{org.name}</strong>
            <span className="org-slug-label">/{org.slug}</span>
            <span className="org-date-label">{new Date(org.created_at).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
