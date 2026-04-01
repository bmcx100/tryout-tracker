import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminNav } from "@/components/admin-nav"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_org_id, is_super_admin")
    .eq("id", user.id)
    .single()

  if (!profile) {
    redirect("/home")
  }

  if (!profile.is_super_admin) {
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", profile.active_org_id)
      .eq("user_id", user.id)
      .single()

    if (!membership || membership.role !== "admin") {
      redirect("/home")
    }
  }

  return (
    <div className="admin-layout">
      <AdminNav />
      {children}
    </div>
  )
}
