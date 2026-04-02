"use client"

import { useAuth } from "@/hooks/use-auth"
import { switchOrg } from "@/lib/actions/organizations"
import { Check, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function OrgSwitcher() {
  const { activeOrgId, userOrgs } = useAuth()

  if (userOrgs.length <= 1) {
    const orgName = userOrgs[0]?.organizations?.name
    if (!orgName) return null
    return <span className="org-switcher-label">{orgName}</span>
  }

  const activeOrg = userOrgs.find((o) => o.org_id === activeOrgId)

  const handleSwitch = async (orgId: string) => {
    if (orgId === activeOrgId) return
    await switchOrg(orgId)
    window.location.href = "/home"
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="org-switcher-trigger">
        <span>{activeOrg?.organizations?.name}</span>
        <ChevronDown className="org-switcher-chevron" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {userOrgs.map((org) => (
          <DropdownMenuItem
            key={org.org_id}
            onClick={() => handleSwitch(org.org_id)}
            className="org-switcher-item"
          >
            {org.org_id === activeOrgId && (
              <Check className="org-switcher-check" />
            )}
            <span>{org.organizations?.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
