# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `npm run dev` (Next.js on port 3000)
- **Build:** `npm run build`
- **Start production:** `npm start`
- **Lint:** `npm run lint` (ESLint with Next.js TypeScript + core web vitals rules)

## Architecture

This is **BMC's React Template** — a Next.js 16 starter using the App Router.

- **Framework:** Next.js 16.1.6 with React 19, TypeScript 5
- **Styling:** Tailwind CSS v4 via `@tailwindcss/postcss` plugin
- **Component library:** shadcn/ui (New York style, Lucide icons, RSC-enabled)
- **Theming:** CSS variables defined in `app/globals.css` using OKLCH color space, with light/dark mode support

### Key paths

- `app/` — Next.js App Router pages and layouts
- `components/ui/` — shadcn/ui components (add more via `npx shadcn@latest add <component>`)
- `lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `components.json` — shadcn/ui configuration

### Path aliases

`@/*` maps to the project root (configured in `tsconfig.json`).

### Adding shadcn/ui components

```bash
npx shadcn@latest add <component-name>
```

Components are placed in `components/ui/` and use `class-variance-authority` for variants, `radix-ui` for primitives, and the `cn()` utility for class merging.

## Debugging & Diagnosis Rules

Before proposing a fix for a production bug:

1. **Blast radius check:** If your proposed root cause were true, what ELSE would be broken? List those things and ask the user whether they've seen those failures too. If they haven't, your diagnosis is wrong — go back and investigate further.
2. **Shared code paths:** When a fix involves changing shared infrastructure (layouts, middleware, utilities, revalidation, auth), verify that other features using the same code path still work. If they do, the shared code is not the problem.
3. **Don't change code you can't justify:** Never remove or modify working patterns (e.g., `revalidatePath`, middleware checks) based on speculation. Get the actual error first (e.g., Vercel function logs, browser console) before making changes.
4. **Localhost vs production:** When a bug only appears in production, focus on what differs between environments (error sanitization, caching, cookie handling, env vars) rather than blaming code that works in both.
5. **Ask before acting:** When uncertain about the root cause, ask the user for more information (logs, reproduction steps, what else they've tested) instead of guessing and shipping a wrong fix.

## Additional Coding Preferences

- Do NOT use semicolons for JavaScript or TypeScript code.
- Do NOT apply tailwind classes directly in component templates unless essential or just 1 at most. If an element needs more than a single Tailwind class, combine them into a custom class using the `@apply` directive.
- Use minimal project dependencies where possible.
- Use `the git switch -c` command to switch to new branches, not `git checkout`.
