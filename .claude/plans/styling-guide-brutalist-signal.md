# Styling Guide — Brutalist Signal (Mobile)

## Role

You are a senior design engineer. Apply this styling guide to every screen, component, and layout in this project. This document defines the visual identity — palette, typography, spacing, animation behavior, and component patterns. It is stack-agnostic. Follow it exactly regardless of what framework or tools are in use.

## Agent Flow — MUST FOLLOW

When the user asks to build something (or this file is loaded into a fresh project), immediately ask **exactly these questions**, then build from the answers. Do not ask follow-ups. Do not over-discuss. Build.

### Questions

1. **"What's the brand name and one-line purpose?"** — Example: "Dispatch — raw intelligence for modern operators."
2. **"What are your 3 key value propositions?"** — Brief phrases. These become the feature cards.
3. **"What should users do?"** — The primary CTA. Example: "Request access", "Start monitoring", "Enter the system".

---

## Design System — "Brutalist Signal" (Light Raw)

- **Identity:** A control room stripped to its essentials — no decoration, pure information density. Raw concrete, exposed structure, signal over noise. Everything earns its place or gets cut.
- **Palette:**
  - Paper `#E8E4DD` — Primary (structural surfaces, active states)
  - Signal `#E63B2E` — Accent (CTAs, alerts, emphasis, status indicators)
  - Concrete `#F5F3EE` — Background (base canvas)
  - Ash `#D4CFC6` — Surface (card backgrounds, input fields)
  - Black `#111111` — Text
  - Steel `#6B6560` — Muted (labels, secondary info, inactive states)
- **Typography:**
  - Headings: "Space Grotesk" (weight 600–700, tight tracking -0.02em)
  - Drama/Emphasis: "DM Serif Display" Italic (hero statements, pull quotes, section breaks)
  - Data/Monospace: "Space Mono" (stats, numbers, labels, system text)
- **Image Mood:** concrete walls, brutalist architecture, raw steel, exposed beams, control panels, industrial lighting, paper textures, type specimens.
- **Hero Line Pattern:** "[Direct verb] the" (Bold Sans) / "[System noun]." (Massive Serif Italic)

---

## Fixed Design Rules (NEVER CHANGE)

These rules apply to every component. They define the aesthetic.

### Visual Texture
- Apply a global noise overlay at **0.05 opacity** — gritty, not smooth. The surface should feel like raw paper or concrete, never flat digital.
- Border radius: **0.5rem max** on all containers. Corners are functional, not decorative. No pill shapes. No soft rounds.
- Card surfaces use Ash with a **2px solid border** in Black at 12% opacity. Borders are visible — they're structural, not hidden.
- Use **visible divider lines** between sections and list items. 1px, Black at 8–12% opacity. Structure should be exposed.

### Micro-Interactions
- All buttons: **sharp, mechanical feel**. Scale to 0.97 on press (press down, not hover up). Fast snap back — no bounce, no spring.
- Primary buttons: Signal red background, white text, 0.5rem radius. On hover/press, background darkens 10%.
- Secondary buttons: transparent background, 2px Black border, Black text. On hover/press, background fills to Black at 5% opacity.
- No lift effects. No floating. Elements press *into* the surface, not away from it.

### Animation Behavior
- Entrance animations: **fast and direct**. Fade in + shift up 12px. No slow reveals.
- Stagger timing: 0.05s between elements. Tight, almost mechanical.
- All motion should feel **abrupt and precise** — like a mechanical switch, not a silk curtain. Short duration (200–300ms), decelerate only.
- Scroll-triggered reveals should fire **early** (when 20% of the element is visible). Content shouldn't wait for the user.

---

## Responsive Layout

Mobile is the primary design target. Desktop expands with structure, not whitespace.

### Breakpoints
- **Mobile** (under 768px): Single-column, bottom tab bar, full-width cards.
- **Desktop** (768px and above): Sidebar navigation replaces tab bar, multi-column content areas.

### Mobile Layout (under 768px)
- Content padding: 16px on each side. Tight — information density matters.
- Sections are **full-screen views** — each fills the viewport height.
- Scrolling should feel like cycling through control panels.
- Bottom tab bar is visible and fixed.

### Desktop Layout (768px and above)
- Max content width: 1200px, horizontally centered.
- **Left sidebar** (220px fixed width): replaces bottom tab bar. Brand name at top in Space Mono uppercase, navigation items vertically stacked with icons and labels. Active item: Signal red 2px left border, Black text. Inactive: Steel text. Sidebar background: Ash with a 2px right border in Black at 12% opacity.
- **Main content area** fills remaining width.
- Bottom tab bar **hidden** on desktop.
- Feature cards arrange in a **3-column grid**.
- Steps cards use the sticky stacking effect at full main-content width.

---

## Component Patterns

### A. App Header
A sticky top bar. Functional, not decorative.
- **Left:** Brand name in Space Mono, uppercase, letter-spaced 0.1em, Black.
- **Right:** A single icon button (menu or status indicator), Black.
- **Background:** Concrete at 90% opacity with subtle blur — mostly opaque, not frosted glass. 1px bottom border in Black at 12% opacity.
- **Height:** 48px. Compact. No wasted vertical space.
- No navigation links in the header. Navigation lives in the bottom tab bar (mobile) or sidebar (desktop).

### B. Hero — "The Control Screen"
Full viewport height. No background image on mobile — **typographic, raw, information-first**.
- System label at top: Space Mono, uppercase, letter-spaced, Steel. Small. Like a terminal prompt or system ID.
- Hero statement massive below: first part in bold Space Grotesk, second part in massive DM Serif Display Italic in Signal red. Follow the hero line pattern.
- Below headline: one line of body copy (Black, 15px), then the primary CTA button (Signal red background, white text, 0.5rem radius).
- **Mobile:** CTA is full-width. Content **left-aligned**, not centered.
- **Desktop:** Two-column. Left: headline + CTA (CTA is auto-width). Right: a large monochrome image (concrete, architecture) with 0.5rem radius and a 2px border.
- **Animation:** Each element snaps in fast — shift up 12px, staggered 0.05s. No slow fades.
- No scroll hint. The content speaks for itself.

### C. Stats Bar — "The Readout"
A row of 3–4 stat blocks. Not pills — **blocks**.
- Each block: Ash background, 0.5rem radius, 2px border, 16px padding.
- Large number in Space Mono (Signal red), tiny label below in Space Mono uppercase (Steel).
- Example stats: "1.2K Active", "99.8% Uptime", "47ms Latency", "3 Regions".
- **Mobile:** Horizontal scroll with snap.
- **Desktop:** Single row, evenly spaced, no scroll.
- **Animation:** Blocks slide in from below, staggered, fast.

### D. Features — "The System Cards"
Three cards from the user's 3 value propositions. Each card is a **functional micro-UI**, not a marketing card.

**Card 1 — "Status Board":** A header strip with a pulsing Signal red dot + "LIVE" label in Space Mono. Below: 3 rows of key-value pairs (label in Steel monospace, value in Black monospace). Data derived from first value prop. Feels like a system status panel.

**Card 2 — "Log Feed":** Monospace text lines appearing one by one, each prefixed with a timestamp in Steel. New lines push old ones up. A blinking Signal red cursor at the bottom. Content derived from second value prop. Feels like a live terminal.

**Card 3 — "Metric Ring":** A circular progress indicator — **not gradient, not soft**. A thick solid stroke in Signal red on an Ash track. Flat cap ends. Large number in the center in Space Mono. Short label below. Animated from 0% to target on scroll. Derived from third value prop.

All cards: Ash background, 2px border, 0.5rem radius, 16px padding.
- **Mobile:** Stacked vertically, full-width, 12px gap.
- **Desktop:** 3-column grid, 16px gap.

### E. Philosophy — "The Statement"
Full-viewport section with **Black background** — the one dark section. Provides contrast.
- Two contrasting statements in light text:
  - "Most [industry] focuses on: [common approach]." — smaller, Space Grotesk, Paper at 50% opacity.
  - "We built for: [differentiated approach]." — massive, DM Serif Display Italic, Paper, with the key word in Signal red.
- **Animation:** Lines appear one at a time, fast fade-up. No word-by-word theatrics.
- **Desktop:** Breaks out full-width edge-to-edge, including behind the sidebar. Text centered, max-width 800px.

### F. Steps — "The Protocol"
Three full-width cards with a **sticky stacking effect** on scroll.
- As each new card scrolls in, the previous card scales to 0.95 and fades to 50% opacity.
- Each card: Ash background, 0.5rem radius, 2px border.
  - Step number: large Space Mono, Signal red.
  - Title: Space Grotesk bold, Black.
  - Two-line description.
  - A **simple geometric element** per card — not illustrated, not decorative. A rotating line, a grid of dots, a pulsing circle. Monochrome. Functional.
- Derive step content from the brand's purpose and process.
- **Mobile:** Full-width cards.
- **Desktop:** Full main-content width. Two-column internal layout — text left, geometric element right.

### G. CTA — "The Terminal"
Final conversion screen. Full viewport height.
- Centered vertically: short punchy headline in DM Serif Display Italic, one line of body copy, CTA button (Signal red, white text, 0.5rem radius).
- Below button: small muted text in Space Mono (Steel) — a system-style message. "No credit card required" or equivalent.
- **Mobile:** CTA is full-width.
- **Desktop:** Centered, 600px max-width. CTA is auto-width.
- **Animation:** Entire block fades up on scroll entry.

### H. Navigation

**Mobile — Bottom Tab Bar:**
- Fixed to bottom.
- Background: Concrete at 95% opacity, minimal blur. 2px top border in Black at 12% opacity.
- Four tabs: icons above tiny Space Mono labels.
- Active tab: Signal red icon + label.
- Inactive tabs: Steel.
- Height: 64px with safe-area padding for notched devices.

**Desktop — Sidebar:**
- Fixed left, full viewport height.
- Width: 220px. Background: Ash. 2px right border in Black at 12% opacity.
- Brand name at top: Space Mono, uppercase, letter-spaced, Black.
- Nav items stacked vertically, 8px gap. Each item: icon + label, 12px vertical padding, 16px horizontal padding, 0.5rem radius.
- Active: Signal red 2px left border, Black text, Paper background at 50% opacity.
- Inactive: Steel text. On hover: Black text.
- Bottom of sidebar: small muted system text (version, status), pinned to bottom.

---

## Build Sequence

After receiving answers to the 3 questions:

1. Map design tokens (palette, fonts, image mood, identity).
2. Generate hero copy from brand name + purpose + hero line pattern.
3. Map the 3 value props to the 3 feature card patterns (Status Board, Log Feed, Metric Ring).
4. Generate Philosophy contrast statements from brand purpose.
5. Generate Steps content from the brand's process/methodology.
6. Build the full app — mobile and desktop layouts. Every component, every animation, every interaction — fully implemented and functional. No placeholders.

**Execution Directive:** Build a control system, not an app. On mobile, every screen should feel like a panel in an operations center. On desktop, the sidebar and grid should feel like a monitoring dashboard. Every animation is mechanical and precise — no float, no bounce, no luxury. Strip everything that doesn't convey information.
