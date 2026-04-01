"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { approveUser, updateUserRole } from "@/lib/actions/users"
import type { UserRole } from "@/lib/types"
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
  const { activeOrgId } = useAuth()
  const [members, setMembers] = useState<OrgMemberWithProfile[]>([])

  const supabase = createClient()

  const fetchMembers = async () => {
    if (!activeOrgId) return
    const { data } = await supabase
      .from("org_members")
      .select("id, user_id, role, approved_at, created_at, profiles(id, email, display_name, created_at)")
      .eq("org_id", activeOrgId)
      .order("created_at", { ascending: false })
    if (data) setMembers(data as OrgMemberWithProfile[])
  }

  useEffect(() => {
    fetchMembers()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId])

  const handleApprove = async (userId: string, role: "lite" | "full") => {
    await approveUser(userId, role)
    fetchMembers()
  }

  const handleRoleChange = async (userId: string, role: UserRole) => {
    await updateUserRole(userId, role)
    fetchMembers()
  }

  const pendingMembers = members.filter((m) => m.role === "pending")
  const approvedMembers = members.filter((m) => m.role !== "pending")

  return (
    <div>
      <h1 className="app-page-title">Users</h1>

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
