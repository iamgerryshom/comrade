# Comrade · Kisii University notifications

Comrade is a mobile-first **installable web app** (and responsive website) that delivers official notices to Kisii University students and staff. **Its key feature: notices reach students even when they're offline.** The site sends the notice in-app (push) and waits for the student's device to confirm receipt (an **ACK**). If no ACK arrives within 60 seconds, Comrade sends an SMS with the key details.

This build is **demo-ready and runs entirely on in-memory dummy data**: there is no backend server and no Firebase project yet. Everything sits behind a service layer that switches to Firebase with one environment variable (Phase 9).

---

## Contents

1. [Quick start](#quick-start)
2. [Demo walkthrough](#demo-walkthrough)
3. [Architecture](#architecture)
4. [Roles & permissions](#roles--permissions)
5. [Delivery engine & SMS fallback](#delivery-engine--sms-fallback)
6. [Data model (planned Firestore structure)](#data-model-planned-firestore-structure)
7. [Installable app (mobile-first) & browser features](#installable-app-mobile-first--browser-features)
8. [Testing & quality](#testing--quality)
9. [Environment variables](#environment-variables)
10. [Phase 9: Firebase hookup](#phase-9-firebase-hookup)
11. [Assumptions](#assumptions)
12. [Data sources](#data-sources)

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173 (opens the login page)
```

You don't need a Firebase project, an SMS provider or any other account.

**Demo password (every account): `comrade123`**

Sign in with one tap from the **Demo accounts** panel on the login page, or type an email, admission number or staff number with the password.

| Demo account | Email | What they can do |
|---|---|---|
| Super Admin | `superadmin@demo.kisiiuniversity.ac.ke` | Users, roles, settings, audit, everything |
| Registrar | `registrar@demo.kisiiuniversity.ac.ke` | Institution admin: whole university |
| Dean (SIST) | `dean.sist@demo.kisiiuniversity.ac.ke` | Their school |
| HOD (Computing) | `hod.computing@demo.kisiiuniversity.ac.ke` | Their department |
| Lecturer | `lecturer@demo.kisiiuniversity.ac.ke` | COMP 210 Data Structures and COMP 211 OOP |
| Student President | `president@demo.kisiiuniversity.ac.ke` | Whole university, incl. URGENT |
| Class Rep | `classrep@demo.kisiiuniversity.ac.ke` | BSc Computer Science, Year 2 only |
| Ordinary Student | `student@demo.kisiiuniversity.ac.ke` | Own inbox, units and profile |
| Student B | `student2@demo.kisiiuniversity.ac.ke` | Same class: use them as the "offline" student |

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the demo (Vite) |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint (+ Prettier compatibility) |
| `npm test` | Vitest unit tests (core logic + mock services) |
| `npm run test:e2e` | Playwright end-to-end tests at phone, tablet and desktop sizes (run `npx playwright install chromium` once first) |
| `npm run format` | Prettier |

### Open it on your phone (same Wi-Fi)

`npm run dev` listens on your network (`server.host = true`). Vite prints a **Network** URL such as `http://192.168.1.20:5173`. Open that URL in your phone's browser. Allow port 5173 through the Windows firewall if asked. (Browser push notifications need HTTPS or `localhost`, so on a LAN IP the in-app toasts still work but system notifications may not.)

---

## Demo walkthrough

**The headline demo: SMS fallback, with three tabs in one browser.**

1. Open **Tab 1** → sign in as **Lecturer**. Open the **Demo** panel (gold button, bottom right) and set the ACK timeout to **15s** so you don't have to wait 60 s.
2. Open **Tab 2** → sign in as **Ordinary Student** (Brian). Leave it open.
3. Open **Tab 3** → sign in as **Student B** (Mercy). Switch on **Simulate offline** in the top bar. A banner confirms this device won't confirm notices.
4. Back in **Tab 1**: go to **Compose** → choose **Unit** → **COMP 210 – Data Structures**. Watch the live count ("This will reach 29 students") and the **SMS preview**, which shows exactly what the fallback SMS will say. Send.
5. You land on the **live delivery timeline**:
   - Brian flips to green **Delivered** within a second, because his tab confirmed receipt. A toast pops up in Tab 2.
   - Mercy shows an amber **Waiting for device 0:14** countdown ring, then turns purple **Sent via SMS**, then **SMS delivered**.
   - The other classmates have no tab open, so they're reached by SMS too. A couple are **SMS skipped**: no phone number, or opted out.
6. In any tab, open **Mock SMS inbox** (sidebar → Demo tools). Pick Mercy's number (or `/demo/sms?uid=u_student2`). The SMS is there **once**, e.g. `[COMRADE-KSU] ACADEMIC: … From: Lecturer COMP210. Ref:K7Q2`.
7. In **Tab 3**, switch **Simulate offline** off. The device catches up and confirms late, and the timeline shows **Delivered after SMS**. No second SMS is ever sent.

**Other things to try**

- **Permissions**: sign in as the **Class Rep**. Compose only offers *BSc Computer Science · Year 2* and individual classmates. *Urgent* is disabled, and you have **10 sends/day**. Look up a classmate by admission number and you'll see a **masked** phone (`+2547•••••321`). A Year 3 student returns "not in your scope", and the search is still audited.
- **Ordinary student**: no Compose, Lookup or Explorer. Visiting `/compose` shows the **403** screen.
- **Explorer** (Dean, HOD, Registrar): browse Institution → School → Department → Course → Year → Unit with live stats and members. The HOD sees only their department unlocked.
- **Analytics** (Registrar, Dean, HOD): in-app vs SMS rate, average ACK time, SMS cost, by school, course and day. **Show as tables** gives an accessible view.
- **Admin** (Super Admin / Registrar): create and edit users, deactivate them, assign leadership positions with a term. **Audit log** shows every send, lookup and role change. **SMS logs** show cost and retries. One student has a number that the mock provider rejects, which demonstrates 3 retries with backoff and then **Failed**.
- **Settings** (Super Admin): ACK timeout, per-position daily limits, SMS sender ID and cost, "Keep demo data after refresh", "Reset demo data".
- **Scheduled notices**: Compose → *Schedule for later*. It's sent automatically when the time comes.
- **SMS reference codes**: `/n/K7Q2` (the `Ref:` in an SMS) opens the full notice.
- **⌘K / Ctrl+K** opens the command palette. Dark mode is in the user menu.

---

## Architecture

```
React UI (pages, components, hooks)          src/features/*, src/components/*
        │  only talks to ↓  (TanStack Query hooks in src/hooks/data.ts)
Service interfaces                           src/services/types.ts
   AuthService · DirectoryService · NotificationService · DeliveryService
   SmsService · AuditService · SettingsService · DeviceService · Functions (callables)
        │
        ├── src/services/mock/      ← used now: in-memory store + simulated server
        └── src/services/firebase/  ← Phase 9: Firebase SDK (Auth, Firestore, Functions, FCM)

Shared business logic                        src/core/  (pure TypeScript: no React, no Firebase)
   permissions.ts · audience.ts · hierarchy.ts · senderLabel.ts · schemas.ts (Zod)
   delivery/state.ts (state machine) · delivery/engine.ts (fallback worker) · delivery/sms.ts
   → used by the mock now; imported unchanged by Cloud Functions in Phase 9
```

- **`VITE_DATA_SOURCE=mock|firebase`** picks the implementation (`src/services/index.ts`). The Firebase SDK is installed, and `src/lib/firebase.ts` only initialises when the source is `firebase` (it's loaded dynamically, so it isn't in the mock bundle).
- **Firebase-shaped API.** The service interfaces copy Firebase's shapes:
  - auth: `onAuthStateChanged`, `signIn(identifier, password)`, `signOut`, `getIdTokenClaims()` returning `{ role, userType, scopes, positions }`
  - data: `subscribeTo…(…, cb) → unsubscribe` (like `onSnapshot`), string ids, `Date` timestamps
- **Callable functions.** Trusted actions are "callables": `sendNotification`, `previewAudience`, `lookupStudent`, `ackDelivery`, `getNodeDetails`, `getAnalytics`, admin actions and more. Every one follows the same pipeline: **check auth → validate with Zod → check permissions → do the work → write the audit log → return a typed result** (`src/services/mock/functions.ts`). They reject unauthorised calls with Firebase-style error codes (`unauthenticated`, `permission-denied`, `invalid-argument`, `not-found`, `resource-exhausted`…).
- **Privacy.** Private fields never leave the "server": phone numbers are returned full, masked or hidden according to `phoneVisibility()`, even in the mock.
- **Fake latency.** The mock adds 100–300 ms of network delay, so skeletons and loading states are real.

### The mock backend

| Piece | How |
|---|---|
| Store | `src/services/mock/store.ts`: Firestore-shaped collections of documents in memory, with atomic `transaction()` |
| Seed data | `src/data/generate.ts` (deterministic seed), built in a **Web Worker** at start-up |
| Multi-tab | Every write is broadcast with **BroadcastChannel**; a newly opened tab asks the others for their current state. Each tab has its own signed-in user (sessionStorage) |
| One "server" | The delivery worker (SMS fallback, scheduled sends, delivery reports, counters) runs in exactly **one** tab, elected with the **Web Locks API** (`navigator.locks.request('comrade-worker')`). If that tab closes, another takes over |
| Persistence | Off by default. **Keep demo data after refresh** saves a snapshot to IndexedDB. **Reset demo data** regenerates it in every tab |

### Folder layout

```
src/
  core/            permissions, audience, hierarchy, delivery engine, SMS builder, Zod schemas (+ tests)
  data/            kisii-structure.json (researched), generator, names, unit catalogue, demo accounts
  types/           Firestore document types
  services/        types.ts (interfaces) · mock/* · firebase/* (Phase 9 stub)
  features/        auth · home · inbox · compose · delivery · explorer · lookup · analytics · admin · settings · demo
  components/      ui/* (shadcn-style, Radix) · layout/* (shell, nav, ⌘K) · common.tsx · DataTable.tsx
  hooks/ lib/      data hooks, theme, online status, push helpers, env, query persistence
firebase/          firestore.rules (draft) · firestore.indexes.json · (functions/ in Phase 9)
e2e/               Playwright tests
public/sw.js       service worker: app-shell cache (installable, opens offline) + web push
public/manifest.webmanifest, public/icons/   install metadata and app icons
```

The original Vite entry files (`src/main.jsx`, `src/App.jsx`, `src/index.css`, `src/App.css`, `vite.config.js`, `eslint.config.js`) are kept and were extended in place. All new code is TypeScript (strict).

**Stack:** React 19, TypeScript, Vite, React Router, Tailwind CSS v4, shadcn-style components on Radix, lucide-react, TanStack Query (persisted to IndexedDB), react-hook-form + Zod, sonner, cmdk, Recharts, framer-motion, Vitest, Playwright.

---

## Roles & permissions

All checks live in **`src/core/permissions.ts`**. Every check is `can(user, action, targetScope)`, with scopes taken from custom claims. The callable functions enforce the rules; the UI also hides what a user can't use.

| Action | Super Admin | Inst. Admin | Dean | HOD | Lecturer | Staff | President | Official | School/Faculty Rep | Class Rep | Student |
|---|---|---|---|---|---|---|---|---|---|---|---|
| View own feed, ACK, read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Send (`notification.send`) | University | University | School | Faculty | Their units | – | University | University | School / Faculty | Course + year (+ unit) | – |
| Send **URGENT** | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | – | – | – | – |
| Search by admission no. | ✓ | ✓ | School | Faculty | Unit students | Read scope | ✓ | ✓ | Scope | Scope | – |
| See full phone number | ✓ | ✓ | ✓ (scope) | ✓ (scope) | ✓ (scope) | ✓ (scope) | masked | masked | masked | masked | own only |
| Explorer (`directory.view`) | ✓ | ✓ | School | Faculty | Units | Read scope | ✓ | ✓ | Scope | Course + year | – |
| Analytics | ✓ | ✓ | School | Faculty | – | – | – | – | – | – | – |
| SMS logs, audit, users, roles | ✓ | ✓ | – | – | – | – | – | – | – | – | – |
| Settings | ✓ | – | – | – | – | – | – | – | – | – | – |
| Daily send limit | – | – | – | – | – | – | 30 | 5 | 20 / 15 | 10 | – |

- **Leadership positions** are their own documents (`userId, position, scopeType, scopeId, yearOfStudy?, startDate, endDate, isActive`). Rights apply only between `startDate` and `endDate`, and history is kept. The demo includes an expired class-rep position.
- **Audit log** records every send and schedule, every admission-number lookup (including those by students, and failed or out-of-scope ones), user and role changes, and settings changes.
- **Custom claims shape** (Phase 9): `{ role, userType, scopes: [{type,id,yearOfStudy?}], positions: [...] }`. This is `computeClaims()`.

---

## Delivery engine & SMS fallback

```
 Sender ── sendNotification() ──▶ validate · permissions · resolve audience (deduplicated)
                                   │
                                   ▼  one delivery per recipient
                        ┌──────── PENDING ────────┐
                        │  push via every channel │  (mock: BroadcastChannel + service worker;
                        ▼                         │   Phase 9: FCM web push)
                      PUSHED ── device ACK ──▶ DELIVERED ── opened ──▶ READ
                        │
          no ACK by ackDeadline (default 60 s, configurable)
                        ▼
              SMS_QUEUED   ← conditional claim: only if still PENDING/PUSHED (exactly once)
               │      │
               │      └─ no phone / opted out (non-urgent) / fallback off ──▶ SMS_SKIPPED (+ reason)
               ▼
           SMS_SENT ── delivery report ──▶ SMS_DELIVERED
               │
               └─ provider error ──▶ retry ×3 with backoff (5 s, 10 s) ──▶ SMS_FAILED

   Late ACK after the SMS ──▶ DELIVERED_AFTER_SMS  (ackedAt recorded, never a second SMS)
```

- **An ACK means the device got it**, not that it was sent. Nothing is marked delivered at send time. ACKs are idempotent and only accepted from the recipient.
- **Exactly once.** `runFallbackCheck()` (`src/core/delivery/engine.ts`) claims each overdue delivery with a conditional transition before sending. Two workers running at the same moment still send one SMS; this is tested. In Firestore the claim is a transaction.
- **Mock timing.** The worker tab checks every 2 s. **Phase 9:** `sendNotification` enqueues a Cloud Task (`checkDelivery`) with a 60 s delay, plus a scheduled function every minute as a safety net.
- **SMS text** (`buildSmsText`, ≤160 chars, truncated cleanly with "…"):
  `[COMRADE-KSU] EXAM: COMP 210 CAT moved to Fri 14 Nov, 10am, LH3. From: Lecturer COMP210. Ref:K7Q2`.
  The Compose screen's preview uses the same function, so the preview is exact.
- **Phone numbers** are Kenyan E.164 (`+2547XXXXXXXX` / `+2541XXXXXXXX`) and validated on input.
- **SMS provider.** `mockSmsProvider` stores messages and shows them on the Mock SMS inbox phone. In Phase 9, SMS is sent only from Cloud Functions via Africa's Talking, batched, with a delivery-report webhook.

---

## Data model (planned Firestore structure)

The in-memory store already uses these collection names and fields (`src/types/index.ts`):

| Collection | Notes |
|---|---|
| `institutions`, `schools`, `faculties`, `courses`, `units` | Hierarchy. Each document stores its parent ids, so no joins are needed |
| `courseUnits` | Course ↔ unit with `yearOfStudy` and `semester` (a unit can be shared by many courses) |
| `users` | `uid, name, email, phone, userType, role, photoURL, isActive, smsOptOut`. Denormalised `schoolId, facultyId, courseId, yearOfStudy, unitIds[]`. Students: `admissionNumber, intakeYear, semester, status`. Staff: `staffNumber, title` |
| `users/{uid}/devices` | Web push tokens, browser, `lastSeenAt` (flat `devices` in the mock) |
| `leadershipPositions` | See above |
| `enrollments` | Full history (student ↔ unit, academic year, semester); `users.unitIds` holds the current semester |
| `unitAssignments` | Lecturer ↔ unit |
| `notifications` | Content, sender, audience rule (`targetType + targetId + yearOfStudy? + includeStaff?`), category, priority, `shortCode`, counts |
| `deliveries` | One per recipient (top level, so the inbox is one query). Denormalised `title, category, priority, senderName, senderId, recipientName, unitId` |
| `smsMessages` | Every SMS attempt: provider id, cost, status, error |
| `savedGroups`, `auditLogs`, `settings/app` | Custom audiences · privileged actions · `ackTimeoutSeconds`, rate limits, sender ID, cost |

- **`firebase/firestore.indexes.json`** holds the composite indexes for these queries: inbox (`userId + createdAt`), fallback scan (`status + ackDeadline`, `status + nextSmsAttemptAt`), timeline, audiences (`courseId + yearOfStudy + isActive`, `unitIds array-contains + isActive`, …), scheduled sends, logs.
- **`firebase/firestore.rules`** (draft, not deployed):
  - Students read only their own deliveries and may only stamp `ackedAt` / `readAt` once (plus `archivedAt`).
  - Full user documents, including phone numbers, are readable only by their owner and admins.
  - Everything scope-based goes through callable functions.
- **Firestore limits.** Audience fan-out runs **inside Cloud Functions**. It writes deliveries in batches of ≤500 (the mock already batches at 500), uses one `array-contains` per query (`unitIds`), and avoids large `in` queries by using denormalised fields. Delivery ids will be deterministic (`${notificationId}_${uid}`), so a rule can check `exists()`.

---

## Installable app (mobile-first) & browser features

Comrade is **one codebase that works as a website and installs as an app**, on phones (the main audience) and on desktop. There's no app store.

### Installing it

| Where | How |
|---|---|
| **Android** (Chrome, Edge, Samsung Internet) | Tap **Install** on the in-app banner, or browser menu → **Install app** / **Add to Home screen** |
| **iPhone / iPad** (Safari) | Tap **Install** → Comrade shows the steps: **Share → Add to Home Screen → Add** |
| **Desktop** (Chrome / Edge) | The **Install** button in the address bar, the in-app banner, or user menu → **Install Comrade app**. It then opens in its own window from the Start menu or taskbar |

The banner appears until Comrade is installed; dismissing it hides it for a week. "Install app" is also available on the login page, in the user menu, and on Profile. Once installed, Comrade opens **full-screen** (no browser bar) with a green splash and status bar, its own icon (including a maskable Android icon), and long-press **shortcuts** (Inbox, Compose, My units).

### Feels like a native app on phones

- **App shell**: fixed top bar and bottom tab bar (Home · Inbox · Units/Compose · Profile). Only the content changes between screens, with no page reloads.
- **Native navigation**: detail screens slide in from the right with a **back arrow and title** in the top bar. Going back slides the other way. The **Android back button** and the browser back button both work, and **scroll position is restored** when you go back. New screens start at the top.
- **Gestures**:
  - **pull to refresh** (Home, Inbox, Sent)
  - in the inbox, **swipe right to mark read** and **swipe left to archive**, with an **Undo** toast
  - **long-press** a notice for a quick-actions sheet (right-click does the same on desktop)
- **Bottom sheets** instead of centred pop-ups on phones, and **haptic feedback** on key actions on Android.
- **Touch polish**: no grey tap flash, no double-tap zoom delay, no accidental text selection on buttons and tabs, 44 px+ tap targets, and safe-area insets for notches and home indicators.
- **Offline**: the service worker caches the app shell, so the installed app opens with no connection. Saved notices, units and the profile come from the IndexedDB query cache, and a **"You're offline"** banner reminds students that urgent notices still arrive by SMS.
- **Notifications**: system notifications with the Comrade icon, an **unread badge** on the app icon where supported, louder vibration for HIGH/URGENT, and tapping a notification opens that notice (`/notice/{id}`). Permission is requested politely after login, never on first load.

### Desktop and tablet

- **Tablets**: two-column inbox (list + notice).
- **Desktop**: collapsible sidebar, multi-column dashboards, sortable/filterable/paginated tables, and the ⌘K palette.
- No horizontal scrolling at any size (checked by an end-to-end test).

### Under the hood

- `public/manifest.webmanifest`, icons in `public/icons/` (192/512, maskable, apple-touch).
- `public/sw.js`: network-first navigations with an app-shell fallback, cache-first for hashed `/assets/*`, and web push. With real FCM (Phase 9) the push carries a signed ACK token, so the worker confirms receipt even when Comrade is closed.
- `src/lib/install.ts`: install-prompt capture, standalone and iOS detection.
- `src/components/layout/PullToRefresh.tsx`, `ScrollManager.tsx`, and `src/hooks/useLongPress.ts`.
- Light on mobile data: route-level code splitting, an instant HTML splash, lazy charts and animation features, and the Inter font (latin subset). The mock demo data is generated in a Web Worker.
- **Accessibility**: keyboard navigation, focus rings, a skip link, ARIA labels, status chips that never rely on colour alone, table views for charts, reduced-motion support, and full dark mode.

### Trying it on your phone

Installing (and push notifications) needs **HTTPS** or `localhost`. `npm run dev` on a LAN IP (`http://192.168.x.x:5173`) runs the app in the phone browser, but it can't be installed there. To test installing on a real phone:
- Option 1: deploy to Firebase Hosting (Phase 9).
- Option 2: use an HTTPS tunnel (e.g. `npx cloudflared tunnel --url http://localhost:4173` after `npm run build && npm run preview`).
- Option 3: on Android, use Chrome's `chrome://inspect` port forwarding so the phone opens it as `localhost`.

## Testing & quality

- **Vitest: 65 tests** (`npm test`):
  - **Permissions:**
    - an ordinary student can't search or send
    - a class rep reaches only their course + year
    - a lecturer reaches only their units
    - the President reaches the whole university
    - expired and not-yet-started positions grant nothing
    - dean, HOD, staff and admin rules
  - **Audience:** every target type, with deduplication.
  - **Delivery engine:**
    - ACK before the deadline means no SMS
    - no ACK means exactly one SMS after the deadline
    - a late ACK becomes DELIVERED_AFTER_SMS, with no second SMS
    - opt-out or no phone means SMS_SKIPPED (URGENT overrides the opt-out)
    - **three concurrent workers still send exactly one SMS each**
    - retries with backoff, then SMS_FAILED
    - the SMS template and its length limit
  - **Mock callables:**
    - unauthenticated and unauthorised calls are rejected
    - Zod validation
    - rate limits
    - masked and audited lookups
    - only the recipient can ACK
    - scheduled notices fan out exactly once
    - drafts
    - auth
  - **Generator:** deterministic, with the expected volumes.
- **Playwright** (`npm run test:e2e`) at phone, tablet and desktop sizes (12 runs):
  - a lecturer sends to a unit; student A (online) shows **Delivered**; student B (**Simulate offline**) gets **exactly one** SMS in the Mock SMS inbox after an 8 s timeout
  - the 403 guard
  - no horizontal scrolling on key screens
  - installable-app basics: manifest, service worker, back arrow returns to the inbox
- **TypeScript strict, ESLint clean.**
- **Lighthouse** (production build, simulated mobile: slow 4G, 4× CPU) on `/` and `/login`: **Accessibility 100 · Best practices 100 · SEO 91 · Performance ≈ 55–62**. Performance is held back mainly by the *in-browser mock backend*: it generates and holds about 20,000 demo records and runs the "server" in the page. In Firebase mode that work disappears (data comes from Firestore), and 90+ is the target to re-measure in Phase 9. Already done for it: instant HTML splash, data generation in a Web Worker, mock start-up deferred on public pages, route-level code splitting, a lazy shell and animations (main JS ≈ 82 kB gzipped).

---

## Environment variables

Copy `.env.example` to `.env` (optional, since the defaults run the demo):

```
VITE_DATA_SOURCE=mock          # mock (default) | firebase (Phase 9)
VITE_DEMO_MODE=true            # demo panel, Mock SMS inbox, demo accounts
VITE_ACK_TIMEOUT_SECONDS=60    # initial ACK timeout (also changeable in Settings / Demo panel)
VITE_FIREBASE_API_KEY=  VITE_FIREBASE_AUTH_DOMAIN=  VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=  VITE_FIREBASE_MESSAGING_SENDER_ID=  VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
```

> **Africa's Talking API keys never go in `VITE_` variables.** Anything prefixed `VITE_` ships to the browser. The SMS keys live in Cloud Functions secrets (`firebase functions:secrets:set AT_API_KEY`, `AT_USERNAME`).

---

## Phase 9: Firebase hookup

*Not started. It waits for your go-ahead.* It will involve:

1. **`src/services/firebase/*`**:
   - Auth: `signInWithEmailAndPassword` after `resolveLoginIdentifier` turns an admission or staff number into an email; claims come from `getIdTokenResult()`.
   - Firestore: `onSnapshot` queries with a `Timestamp → Date` converter and offline persistence.
   - Callables: `httpsCallable` for every `Functions` method.
   - Push: FCM web push tokens in `users/{uid}/devices`.
   - Storage: attachment uploads.
2. **`firebase/functions/`** (TypeScript, importing `src/core` unchanged):
   - `sendNotification`: audience resolution, batched fan-out ≤500, FCM multicast, enqueues a **Cloud Task** for `checkDelivery` at +60 s.
   - `checkDelivery`, plus a **scheduled** safety-net function every minute: `runFallbackCheck` with Firestore transactions.
   - `ackDelivery`: callable, plus a token endpoint for service-worker ACKs; also `lookupStudent`, `previewAudience`, `getNodeDetails`, `getAnalytics` and the admin functions.
   - **Africa's Talking** SMS sending (batched) and a **delivery-report webhook** (HTTPS function) that sets `SMS_DELIVERED` / `SMS_FAILED`.
   - **Custom claims** on user create/update and on position changes (`computeClaims`).
   - An `onDeliveryUpdate` trigger for counters and the status derived from `readAt` / `ackedAt`.
3. **Seed script**: upload the same generated dataset to Firestore and create matching Firebase Auth users (`generateDataset()` output is already keyed by collection).
4. **Emulator setup** (Auth, Firestore, Functions) and deploy steps (`firebase deploy --only firestore:rules,firestore:indexes,functions,hosting`).
5. **Plan.** Cloud Functions that call external services (Africa's Talking) need the **Firebase Blaze (pay-as-you-go)** plan.

---

## Assumptions

- **Kisii University structure.** School → Department → Programme maps to School → **Faculty / Department** → Course.
  - Where an official page didn't say which department a programme belongs to, I assigned it by subject (`"departmentInferred": true` in the JSON).
  - Course codes (e.g. `BSCS`) are invented abbreviations.
  - The School of Health Sciences lists about 20 departments, most of them clinical specialties without programmes, so only the 7 that offer programmes are included.
- **Units are invented** (`demo: true`), since unit lists aren't published.
  - Each department has a shared pool (3 per year, offered to all its courses), each course has 4 course-specific units per year, and all year-1 certificate/diploma/degree courses share UCC 101–103.
  - That gives about 7 units per year (5 this semester), and many units are shared across courses.
- **People are fake.** Kenyan-style names, emails `@demo.kisiiuniversity.ac.ke`, and phone numbers in the `+2547000xxxxx` block (Kenya has no official fictional range; this block was chosen to look obviously fake).
  - Admission numbers follow `COURSE/0123/INTAKEYEAR`.
  - About 3% of students have no phone and about 5% opted out of non-urgent SMS. `+254700099999` is deliberately rejected by the mock provider.
- **Volume.** About 470 students, with most in 10 popular courses and every course having at least 2.
  - There are **69 staff**, not ~30, because the spec asks for a dean per school (8) and an HOD per department (32) on top of lecturers and admins.
  - There are 104 leadership positions and 40 past notices with mixed outcomes.
- **Academic calendar.** September–August. Semester 1 runs September–December and semester 2 January–August.
- **Who counts as a recipient.** "Whole university / school / faculty" targets are students by default. Staff senders can tick *Also include staff*. The sender never receives their own notice.
- **Lecturer reach.** A lecturer may message students enrolled in their units, and any one of those students individually, but not whole courses.
- **General staff** (`STAFF`) can look up students and browse the Explorer in their school/department (read-only), but can't send.
- **URGENT.** All sending staff roles and the Student President may send URGENT. Student officials may not and have the tightest limit (5/day).
- **Opening counts as an ACK.** Reading a notice in the app also records the device ACK if none arrived yet.
- **Demo persistence.** "Keep demo data after refresh" uses **IndexedDB** rather than localStorage, because the snapshot (~20k records) exceeds localStorage's ~5 MB limit.
- **Web push in mock mode.** In mock mode a "push" reaches only open Comrade tabs (BroadcastChannel). A fully closed browser can't receive anything until real FCM web push (Phase 9). In the demo, "offline" therefore means the **Simulate offline** toggle or no open tab, both of which correctly trigger the SMS fallback.
- **Installable app.** Your later request ("make it app like … installable") replaces the earlier "no PWA / no manifest" rule. It's a web app manifest + service worker; there's still no native app or app store.
- **Template files.** The original Vite template (`App.jsx`, `main.jsx`, CSS, config) was kept and extended in place. The Vite logo favicon was replaced with the Comrade mark, and the unused template images in `src/assets/` and `public/icons.svg` were left untouched.

---

## Data sources

Collected on **2026-11-06** from official Kisii University sites. `www.kisiiuniversity.ac.ke` refused direct connections from the research tool (`ECONNREFUSED`), so the pages were read through web-search results of the official domain. The full structure, with a `sourceUrl` per school, is in `src/data/kisii-structure.json`.

| School | Departments | Programmes | Sample programmes | Dept. inferred | Unverified |
|---|---|---|---|---|---|
| Information Science & Technology (SIST) | 2 | 19 | BSc Computer Science; BSc Software Engineering | 2 | 0 |
| Business and Economics (SOBE) | 5 | 11 | Bachelor of Commerce; Bachelor of Economics and Statistics | 9 | 0 |
| Pure and Applied Sciences (SPAS) | 4 | 15 | Bachelor of Actuarial Science; BSc Mathematics and Computing | 7 | 0 |
| Health Sciences (SHS) | 7 | 12 | BSc Nursing; BSc Clinical Medicine; MBChB | 2 | 3 |
| Arts and Social Sciences (SASS) | 7 | 15 | BA Geography; BA Counselling Psychology | 6 | 0 |
| Education and Human Resource Development (SEHRD) | 2 | 7 | B.Ed (Arts); B.Ed (Science) | 7 | 0 |
| Agriculture and Natural Resources Management (SANRM) | 4 | 9 | BSc Agriculture; BSc Horticulture | 7 | 0 |
| Law (SOL) | 1 | 2 | Bachelor of Laws (LL.B.); Diploma in Laws | 0 | 0 |
| **Total** | **32** | **90** | | | |

**Gaps.**
- *Bachelor of Pharmacy*, *BSc Medical Laboratory Science* and *BSc Food, Nutrition and Dietetics* are listed as departments or areas but exact programme titles weren't confirmed, so they're marked `verified: false`.
- Department and programme lists differ between the school pages, the programme index and the 2019 handbook; I used the newest official pages.
- SOBE: the school site lists 4 departments while the programmes page names a fifth (Human Resource and Strategic Management); all 5 are included.
- The Department of Applied Aquatic Sciences has no programmes listed.
- The university's "130+ programmes" claim couldn't be fully reconciled with the school pages.

**URLs used**

- https://kisiiuniversity.ac.ke/%D7%97%D7%96%D7%99%D7%AA%D7%99l/d/school-of-information-technology/academics
- https://sist.kisiiuniversity.ac.ke/programmes/
- https://kisiiuniversity.ac.ke/%D7%97%D7%96%D7%99%D7%AA%D7%99l/d/school-of-business-and-economics/academics
- https://sobe.kisiiuniversity.ac.ke/
- https://kisiiuniversity.ac.ke/dpt/department-of-accounting-and-finance/programs
- https://kisiiuniversity.ac.ke/%D7%97%D7%96%D7%99%D7%AA%D7%99l/d/school-of-pure-and-applied-science/academics
- https://spas.kisiiuniversity.ac.ke/
- https://kisiiuniversity.ac.ke/dpt/department-of-mathematics-and-actuarial-sciences
- https://kisiiuniversity.ac.ke/%D7%97%D7%96%D7%99%D7%AA%D7%99l/d/school-of-health-sciences/academics
- https://kisiiuniversity.ac.ke/dpt/department-of-clinical-medicine
- https://kisiiuniversity.ac.ke/%D7%97%D7%96%D7%99%D7%AA%D7%99l/d/school-of-arts-and-social-science/academics
- https://kisiiuniversity.ac.ke/schools_departments
- https://kisiiuniversity.ac.ke/%D7%97%D7%96%D7%99%D7%AA%D7%99l/d/school-of-education-and-human-resource-development/academics
- https://kisiiuniversity.ac.ke/%D7%97%D7%96%D7%99%D7%AA%D7%99l/d/school-of-law/academics
- https://sanrm.kisiiuniversity.ac.ke/programmes/
- https://kisiiuniversity.ac.ke/our-programmes
- https://admissions.kisiiuniversity.ac.ke/academic/programmes
