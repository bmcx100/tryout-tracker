# V3 Sorting Wizard — Design Spec

**Date:** 2026-03-27
**Version:** V3 (tagged V2 at commit `1f1bffc`)

## Overview

Replace the current Home page (competition landscape with tabs, filters, and toggles) with a step-by-step sorting wizard. First-time users are guided through three clear steps. Returning users see their last result with an obvious way to re-run the sorter.

## The Problem

V2's Home page presents too many options at once — tabs, position filters, drag-reorder, team toggles, pinning. Users don't understand what to do or where to start.

## The Solution

A wizard that walks users through one decision at a time:

1. Pick a position
2. Rank the teams
3. See the resulting rosters

Each position (Forwards, Defense, Goalies) is a separate run with its own saved state.

---

## Wizard Steps

### Step 1 — Pick a Position

- **Headline:** "Pick a position"
- **Subtext:** "You'll rank the teams, then see where everyone lands."
- **UI:** Three large tappable cards — Forwards, Defense, Goalies
- **Extra:** If they've completed a sort for another group before, offer: "Use the same team order as your [previous group] sort?"

### Step 2 — Rank the Teams

- **Headline:** "Rank the teams"
- **Subtext:** "Drag teams from strongest to weakest. Players from higher-ranked teams will fill top spots first."
- **UI:** Draggable list of previous teams (both U13 + U15 age groups, since both feed into next year's target age group)
- **Action:** "Next" button at bottom

### Step 3 — Your Resulting Teams

- **Headline:** "Here's how it shakes out"
- **Subtext:** "These are the projected rosters based on your ranking. Drag players between teams to fine-tune."
- **UI:** Resulting team rosters for the target age group only. Players are draggable between teams.
- **Action:** "Done" button saves and transitions to the results view

---

## Return Visit — Results View

- Shows the user's most recent completed sort
- Clear label identifying what it is: "Your Forwards Sort", "Your Defense Sort", etc.
- Results are the same layout as Step 3 (still editable/tweakable)
- Prominent "Run the Sorter" button to jump back to Step 1

---

## Data Model Changes

### `user_competition_prefs` table

Add `position_group` column to scope sorts per position:

- **Column:** `position_group` — enum-like text: `forwards`, `defense`, `goalies`
- Each user can have up to 3 rows (one per position group)
- Existing columns (team order, player overrides/pins) remain — just scoped per group now
- Add `last_viewed` timestamp to track which result to show on return visits
- **Migration:** Existing rows get `position_group = 'forwards'` as default (or cleared if preferred)

No new tables required.

---

## Component Architecture

All within `app/(app)/home/`:

| Component | Purpose |
|-----------|---------|
| `page.tsx` | Orchestrator — checks for existing sorts, routes to wizard or results view |
| `step-position.tsx` | Step 1 — position picker cards |
| `step-rank-teams.tsx` | Step 2 — draggable team ranking list |
| `step-results.tsx` | Step 3 — resulting rosters with player drag |
| `results-view.tsx` | Return visit — last sort display + "Run the Sorter" button |

### Reuse from V2

- Drag-and-drop team ordering logic (refactored from current Sort Order tab)
- Resulting roster rendering (refactored from current Resulting Teams tab)
- Player drag between teams (existing functionality)
- Crew highlighting (hearts on crew members in results)

### Removed from V2

- Tab navigation on Home (Sort Order / Resulting Teams tabs)
- Position filter bar (replaced by Step 1 position selection)
- Toggle between views (wizard flow replaces this)

---

## UX Principles

- **One thing at a time.** Each step has a single decision.
- **Clear instructions.** Imperative headlines tell users what to do. Subtext explains why.
- **No jargon.** Keep copy simple and direct.
- **Minimal chrome.** No tabs, toggles, or filters visible during the wizard.
- **Easy re-entry.** Return visitors see results immediately with one button to start over.

---

## Crew Integration

Crew management stays in the Players section. Crew members are highlighted (heart icon) in Step 3 results and the results view, same as V2. No crew setup in the wizard itself.

---

## Age Group Context

Previous teams show both U13 and U15 because both age groups feed into next year's target teams (e.g., current 12-year-olds from U13 + current 13-year-olds from U15 both try out for next year's U15). Resulting rosters only show the target age group.

---

## Scope Boundaries

**In scope:**
- Wizard flow (3 steps + results view) replacing Home page
- Per-position-group saved sorts in `user_competition_prefs`
- Instructional copy at each step
- Reuse of existing drag/sort/roster components

**Out of scope:**
- Changes to Players page, Crew, Tryouts, or Admin sections
- Changes to auth flow or landing page
- New database tables
- Scenario builder (stays in Tryouts section as-is)
