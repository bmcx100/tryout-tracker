"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { approveUser, updateUserRole } from "@/lib/actions/users"
import type { Profile, UserRole } from "@/lib/types"
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

export default function AdminUsersPage() {
  const { loading: authLoading } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])

  const supabase = createClient()

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
    if (data) setUsers(data)
  }

  useEffect(() => {
    if (authLoading) return
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
      if (data) setUsers(data)
    }
    load()
  }, [authLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = async (userId: string, role: "lite" | "full") => {
    await approveUser(userId, role)
    fetchUsers()
  }

  const handleRoleChange = async (userId: string, role: UserRole) => {
    await updateUserRole(userId, role)
    fetchUsers()
  }

  const pendingUsers = users.filter((u) => u.role === "pending")
  const approvedUsers = users.filter((u) => u.role !== "pending")

  return (
    <div>
      <h1 className="app-page-title">User Management</h1>

      {pendingUsers.length > 0 && (
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
              {pendingUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.display_name || "—"}</TableCell>
                  <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="admin-actions">
                      <button className="btn-primary" onClick={() => handleApprove(user.id, "lite")}>
                        Approve (Lite)
                      </button>
                      <button className="btn-secondary" onClick={() => handleApprove(user.id, "full")}>
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
            {approvedUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.display_name || "—"}</TableCell>
                <TableCell>
                  <Select
                    value={user.role}
                    onValueChange={(val) => handleRoleChange(user.id, val as UserRole)}
                  >
                    <SelectTrigger className="admin-role-select">
                      <Badge variant="outline">{user.role}</Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.filter((r) => r !== "pending").map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {user.approved_at
                    ? new Date(user.approved_at).toLocaleDateString()
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
