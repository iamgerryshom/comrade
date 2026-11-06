# Comrade — Audit of the existing project (Phase −1)

> **Status (2026-11-06):** Phases 0–8 have been carried out on top of this project. The existing
> files were kept and extended in place (no restructuring, nothing deleted). See the README for the
> result. The plan below is kept as the historical audit.

_Date: 2026-11-06 · Auditor: Claude Code_

## 1. What exists today

| Item | Finding |
|---|---|
| Build tool | **Vite 8.3.6** with `@vitejs/plugin-react` 6 (Oxc) |
| Framework | **React 19.3**, plain **JavaScript** (`.jsx`). No TypeScript config |
| Routing | None (no React Router) |
| State / data | None |
| Styling | Plain CSS (`src/index.css`, `src/App.css`): the stock Vite template theme (purple accent `#aa3bff`, system font). No Tailwind |
| Firebase | None (no SDK, no config, no `.env`) |
| Lint | ESLint 10 flat config (`js` recommended + react-hooks + react-refresh), JS/JSX only |
| Tests | None |
| PWA / Capacitor | None |
| Git | Was **not** a repo. I ran `git init` and committed the untouched state as `218ef69 chore: snapshot of existing comrade project before upgrade` |
| `../../backend/` | Empty folder. Per the spec (Firebase only), it will stay unused |

### Source files (all of them)

```
index.html               <title>comrade</title>, loads /src/main.jsx
src/main.jsx             createRoot + StrictMode
src/App.jsx              Vite "Get started" counter demo page
src/App.css, index.css   Template styles
src/assets/hero.png, react.svg, vite.svg   Template images
public/favicon.svg       Vite logo (purple bolt)
public/icons.svg         Template social/doc icon sprite
README.md                Stock "React + Vite" template README
eslint.config.js, vite.config.js, .gitignore, package(-lock).json
```

## 2. Health check (run results)

| Check | Result |
|---|---|
| `npm install` | ✅ OK |
| `npm run lint` | ✅ 0 errors / 0 warnings |
| `npm run build` | ✅ Built in ~0.6 s (222 kB JS, 69 kB gzip) |
| `npm run dev` | ✅ Serves HTTP 200 on localhost |
| `npm audit` | ⚠️ 4 **moderate**, dev-only, in the ESLint 10 tree (`minimatch`, `@eslint/config-array`). They don't ship to users. I'll fix this when the tooling is upgraded, not with `--force` |

**Nothing is broken, but nothing is built yet either.** The project is a freshly scaffolded Vite + React template. There are no Comrade screens, components, branding or features to keep yet. The only real assets are the project name `comrade`, the Vite + React 19 setup, and the ESLint config.

## 3. Gap analysis against the spec

Everything below is missing. ✅ means it's already there.

**Foundation**
- [x] Vite + React (keep, and upgrade the config to TS)
- [ ] TypeScript (strict), `tsconfig`, typed ESLint (`typescript-eslint`), Prettier
- [ ] Tailwind CSS v4 (`@tailwindcss/vite`) + shadcn/ui + lucide-react; brand tokens (deep green + warm gold), Inter, dark mode
- [ ] React Router, app shell (bottom tabs on mobile, sidebar on desktop, top bar, ⌘K palette)
- [ ] TanStack Query (+ IndexedDB persistence), react-hook-form + Zod, sonner, cmdk, recharts, framer-motion, Zustand (UI state only if needed)
- [ ] `src/types/`, `src/services/types.ts` (8 service interfaces), `src/services/mock/*`, `src/services/firebase/*` (stubs), `src/lib/firebase.ts` (inactive), `VITE_DATA_SOURCE` switch
- [ ] In-memory Firestore-shaped store + BroadcastChannel tab sync + Web Locks worker election + optional localStorage snapshot
- [ ] `.env.example`

**Data**
- [ ] Research the official Kisii University schools, departments and programmes → `src/data/kisii-structure.json` (with sources)
- [ ] Seeded generator `src/data/generate.ts` (~300–500 students, ~30 staff, leaders, ~40 historical notifications)

**Auth and permissions**
- [ ] Mock AuthService shaped like Firebase Auth (`onAuthStateChanged`, `signIn(identifier, pw)`, claims), sessionStorage per tab
- [ ] `src/core/permissions.ts` (scoped `can(user, action, scope)`), leadership positions with expiry, rate limits, audit logging
- [ ] Login + demo accounts panel, route guards, 403 and 404 pages

**Features**
- [ ] Explorer tree, My units/course, student lookup (scoped, masked, audited)
- [ ] Compose + audience builder + live count + SMS preview + drafts + scheduling + mock attachments
- [ ] Inbox (filters, search, infinite scroll, swipe, real-time toast) + notice detail
- [ ] `src/core/delivery/*` state machine, ACK flow, SMS fallback worker, MockSmsService, Mock SMS Inbox (phone UI), simulate-offline, live delivery timeline with countdown
- [ ] User and role management, leadership positions, analytics, SMS logs, audit log, settings, profile and preferences
- [ ] Demo panel (`VITE_DEMO_MODE`)

**Responsive website and browser features** (spec revised: website only, so no PWA install, manifest, Capacitor or APK)
- [ ] Mobile-first responsive layout: phone (<640, top bar + bottom nav), tablet (640–1024, two-column inbox), desktop (>1024, collapsible sidebar). No horizontal scrolling
- [ ] Tables become card lists on phones; pop-ups become full-width sheets; 44px+ tap targets
- [ ] Service worker for **web push only** (simulated in mock mode): background ACK + browser notification; tapping it opens `/notice/{id}`
- [ ] Polite notification-permission prompt after login; offline banner with an SMS reminder
- [ ] Performance: lazy-loaded routes and images, small bundles (Lighthouse mobile perf and a11y 90+)

**Quality and docs**
- [ ] Vitest (permissions, audience, delivery engine, mock callable rejection)
- [ ] Playwright at 360×800, 768×1024 and 1440×900 (the lecturer → 2 students end-to-end flow)
- [ ] `firebase/firestore.rules`, `firebase/firestore.indexes.json` (drafts)
- [ ] README (architecture, permissions matrix, delivery diagram, Firestore structure, Phase 9, assumptions, data sources)

## 4. Template files I propose to remove (need your OK)

These files are Vite boilerplate with no Comrade content. I'd replace or delete them in Phase 1:

| File | Action |
|---|---|
| `src/App.jsx` | Replace with `src/App.tsx` (router + providers) |
| `src/main.jsx` | Replace with `src/main.tsx` |
| `src/App.css`, `src/index.css` | Replace with a Tailwind-based `src/index.css` holding the Comrade theme tokens |
| `src/assets/hero.png`, `react.svg`, `vite.svg` | Delete |
| `public/favicon.svg`, `public/icons.svg` | Replace with Comrade icons (green and gold) |
| `README.md` | Rewrite as the Comrade README |
| `eslint.config.js`, `vite.config.js` | Convert to TS-aware versions (keep the same rules, add `typescript-eslint` + Prettier) |

All of them stay recoverable from commit `218ef69`.

## 5. Plan: from template to finished product

The stack decision is to **keep Vite 8 + React 19** and add everything in Section 2 of the spec around it.

| Phase | Deliverable | Commit |
|---|---|---|
| 0 Research | Fetch official kisiiuniversity.ac.ke pages → `kisii-structure.json`, summary table and gaps for your review | `data: Kisii University structure` |
| 1 Foundation | TS strict, Tailwind v4 + shadcn, theme, responsive layout (phone/tablet/desktop); types, service interfaces, mock store (BroadcastChannel + Web Locks), seeded generator; Firebase SDK + inactive `lib/firebase.ts`; Vitest set up | `feat: foundation` |
| 2 Auth & roles | Mock auth, login + demo accounts, `core/permissions.ts` + tests, route guards, 403 | `feat: auth and permissions` |
| 3 Hierarchy | Explorer, My units, scoped and audited student lookup | `feat: hierarchy` |
| 4 Notifications | Compose / audience builder / SMS preview, inbox, detail, real-time | `feat: notifications` |
| 5 Delivery engine | `core/delivery` + tests, ACK, worker, MockSms, SMS inbox, simulate-offline, timeline | `feat: delivery engine` |
| 6 Admin & analytics | Users and roles, positions, analytics, SMS logs, audit, settings | `feat: admin and analytics` |
| 7 Responsive & browser | Check every screen at 3 sizes, push service worker with background ACK, permission prompt, offline banner, performance pass | `feat: responsive and browser features` |
| 8 Polish | Welcome, accessibility, Playwright, rules and indexes drafts, final README | `chore: polish and docs` |
| 9 Firebase | **Not started until you say so** | — |

After each phase I'll run lint, the type check, tests and the build, then give you a short summary.

### Risks and notes
- **Vite 8 / React 19 are very new.** Some tools (e.g. shadcn's generator) may declare older peer ranges. I'll install with matching versions. If a tool truly isn't compatible, I'll tell you before changing anything (for example, pinning Vite 7).
- **The push service worker is hand-written** (`public/sw.js`, no `vite-plugin-pwa`), because the spec rules out an installable PWA. It handles push and notification clicks only, with no offline caching of the site.
- **"Simulated push" in mock mode**: the open tabs get the notice via BroadcastChannel, and the service worker shows the browser notification. A truly closed browser can't receive anything until real FCM web push exists (Phase 9). In the demo, "offline" means the "Simulate offline" toggle (or no open tab), which then triggers the SMS fallback.
- **Kisii University website**: if pages are unreachable or incomplete, entries will be marked `"verified": false` and listed as gaps.
- **`../../backend/`** is empty and will not be used (Firebase only).
