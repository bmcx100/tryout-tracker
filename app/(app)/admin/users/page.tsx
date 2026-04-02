"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { approveUser, updateUserRole } from "@/lib/actions/users"
import { addPreApprovedEmail, removePreApprovedEmail } from "@/lib/actions/pre-approved-emails"
import type { UserRole, PreApprovedEmail } from "@/lib/types"
import QRCode from "qrcode"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const ROLES: UserRole[] = ["pending", "lite", "full", "admin"]

interface OrgMemberWithProfile {
  id: string
  user_id: string
  role: UserRole
  approved_at: string | null
  created_at: string
  profiles: {
    id: string
    email: string
    display_name: string | null
    created_at: string
  }
}

export default function AdminUsersPage() {
  const { activeOrgId, userOrgs } = useAuth()
  const [members, setMembers] = useState<OrgMemberWithProfile[]>([])
  const [preApproved, setPreApproved] = useState<PreApprovedEmail[]>([])
  const [qrDataUrl, setQrDataUrl] = useState("")
  const [copied, setCopied] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [newRole, setNewRole] = useState<"lite" | "full" | "admin">("lite")
  const [preApproveError, setPreApproveError] = useState("")

  const activeOrg = userOrgs.find((o) => o.org_id === activeOrgId)
  const orgSlug = activeOrg?.organizations?.slug ?? ""
  const inviteLink = typeof window !== "undefined" && orgSlug
    ? `${window.location.origin}/join/${orgSlug}`
    : ""

  const supabase = createClient()

  const fetchMembers = async () => {
    if (!activeOrgId) return
    const { data } = await supabase
      .from("org_members")
      .select("id, user_id, role, approved_at, created_at, profiles(id, email, display_name, created_at)")
      .eq("org_id", activeOrgId)
      .order("created_at", { ascending: false })
    if (data) setMembers(data as unknown as OrgMemberWithProfile[])
  }

  const fetchPreApproved = async () => {
    if (!activeOrgId) return
    const { data, error } = await supabase
      .from("pre_approved_emails")
      .select("*")
      .eq("org_id", activeOrgId)
      .order("created_at", { ascending: false })
    if (error) console.error("pre_approved fetch error:", error)
    if (data) setPreApproved(data as PreApprovedEmail[])
  }

  useEffect(() => {
    fetchMembers()
    fetchPreApproved()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId])

  useEffect(() => {
    if (inviteLink) {
      QRCode.toDataURL(inviteLink, { width: 200, margin: 2 }).then(setQrDataUrl)
    }
  }, [inviteLink])

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleApprove = async (userId: string, role: "lite" | "full") => {
    await approveUser(userId, role)
    fetchMembers()
  }

  const handleRoleChange = async (userId: string, role: UserRole) => {
    await updateUserRole(userId, role)
    fetchMembers()
  }

  const handleAddPreApproved = async () => {
    setPreApproveError("")
    try {
      await addPreApprovedEmail(newEmail, newRole)
      setNewEmail("")
      fetchPreApproved()
    } catch (err) {
      setPreApproveError(err instanceof Error ? err.message : "Failed to add")
    }
  }

  const handleRemovePreApproved = async (id: string) => {
    await removePreApprovedEmail(id)
    fetchPreApproved()
  }

  const pendingMembers = members.filter((m) => m.role === "pending")
  const approvedMembers = members.filter((m) => m.role !== "pending")

  return (
    <div>
      <h1 className="app-page-title">Users</h1>

      {inviteLink && (
        <div className="admin-card">
          <h2 className="admin-card-title">Invite Parents</h2>
          <p className="admin-card-desc">Share this link or QR code with parents to let them request access.</p>
          <div className="invite-section">
            <Input value={inviteLink} readOnly />
            <Button onClick={handleCopyLink}>
              {copied ? "Copied!" : "Copy Link"}
            </Button>
          </div>
          {qrDataUrl && (
            <img src={qrDataUrl} alt="Invite QR code" className="invite-qr" />
          )}
        </div>
      )}

      <div className="admin-card">
        <h2 className="admin-card-title">Pre-Approve Emails</h2>
        <p className="admin-card-desc">
          Add emails to skip the approval queue when they sign up.
        </p>
        <div className="preapproved-form">
          <Input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="parent@email.com"
            type="email"
          />
          <Select value={newRole} onValueChange={(v) => setNewRole(v as "lite" | "full" | "admin")}>
            <SelectTrigger className="preapproved-role-select">
              <Badge variant="outline">{newRole}</Badge>
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
              <SelectItem value="lite">lite</SelectItem>
              <SelectItem value="full">full</SelectItem>
              <SelectItem value="admin">admin</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleAddPreApproved} disabled={!newEmail.trim()}>
            Add
          </Button>
        </div>
        {preApproveError && <p className="preapproved-error">{preApproveError}</p>}
      </div>

      {pendingMembers.length > 0 && (
        <div className="admin-section">
          <h2 className="admin-section-title">Pending Approval</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>{member.profiles?.email}</TableCell>
                  <TableCell>{member.profiles?.display_name || "—"}</TableCell>
                  <TableCell>{new Date(member.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="admin-actions">
                      <button className="btn-primary" onClick={() => handleApprove(member.user_id, "lite")}>
                        Approve (Lite)
                      </button>
                      <button className="btn-secondary" onClick={() => handleApprove(member.user_id, "full")}>
                        Approve (Full)
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="admin-section">
        <h2 className="admin-section-title">All Users</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Approved</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preApproved.map((entry) => (
              <TableRow key={`pre-${entry.id}`} className="preapproved-table-row">
                <TableCell>{entry.email}</TableCell>
                <TableCell>—</TableCell>
                <TableCell>
                  <Badge variant="outline">{entry.role}</Badge>
                </TableCell>
                <TableCell>
                  <div className="preapproved-status">
                    <span className="preapproved-label">pre-approved</span>
                    <button
                      className="btn-danger-sm"
                      onClick={() => handleRemovePreApproved(entry.id)}
                    >
                      Remove
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {approvedMembers.map((member) => (
              <TableRow key={member.id}>
                <TableCell>{member.profiles?.email}</TableCell>
                <TableCell>{member.profiles?.display_name || "—"}</TableCell>
                <TableCell>
                  <Select
                    value={member.role}
                    onValueChange={(val) => handleRoleChange(member.user_id, val as UserRole)}
                  >
                    <SelectTrigger className="admin-role-select">
                      <Badge variant="outline">{member.role}</Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.filter((r) => r !== "pending").map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {member.approved_at
                    ? new Date(member.approved_at).toLocaleDateString()
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
