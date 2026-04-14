# Auth Loading Hang — "Loading players..." / "Loading organization..."

## Symptom
Home page gets stuck on loading screen indefinitely. Affects all users intermittently, including super admin accounts with valid profiles and org memberships.

## Root Cause (confirmed via diagnostics)
`supabase.auth.getUser()` in the auth provider hangs for 12+ seconds without returning. The 12s timeout fires, forces `loading=false`, but by then no profile or org data was fetched. `activeOrgId` stays null and the page is stuck on "Loading organization..."

### Console evidence (2026-04-14):
```
[home] waiting for activeOrgId (authLoading=true)
[auth] init timed out after 12000ms — forcing loading → false
[home] activeOrgId null after auth loaded — retrying orgs fetch
```
No `[auth] user:` log ever appears — `getUser()` never returned.

### On-screen diagnostic:
```
user=yes, profile=null, orgs=0, retried=true · 19s
```

## Why getUser() hangs
`getUser()` makes a network request to the Supabase auth server to verify the JWT. If the Supabase server is slow, or the token refresh stalls, the entire auth init blocks. This is a known pain point with Supabase SSR client-side auth.

## Fix attempts

### Attempt 1 — Diagnostic logging (2026-04-14, commit 6a863ed)
- Added loading phase indicators: "Authenticating..." / "Loading organization..." / "Fetching players..."
- Added debug line at bottom of screen showing internal state + elapsed time
- **Result:** Identified that auth init times out and profile is never fetched

### Attempt 2 — Expanded diagnostics (2026-04-14, commit ff13ca8)
- Added user/profile/orgs state to debug line
- **Result:** Confirmed `user=yes, profile=null, orgs=0` — getUser() timeout is the root cause

### Attempt 3 — Use getSession() instead of getUser() (2026-04-14, pending)
- `getSession()` reads from local storage (no network call), so it returns instantly
- Load profile/orgs immediately based on session
- Run `getUser()` in background for verification only — if it fails, clear state and redirect to /login
- Falls back to `getUser()` only when no local session exists (e.g., fresh OAuth callback)
- Reduced timeout from 12s to 8s
- Extracted `loadUserData()` helper to avoid duplication
- **Rationale:** The middleware already refreshes the token on every request via `getUser()`. The client-side auth provider doesn't need to re-verify — it can trust the session the middleware already validated.
- **Result:** TBD — needs testing
