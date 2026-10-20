# UX desk review (WS3.1) and accessibility / responsive pass (WS3.3, WS3.4)

**Prepared:** 2026-10-14 · **Method:** heuristic desk review of the code and UI flows against Nielsen's 10 usability heuristics and WCAG 2.1 AA, at 360 / 768 / 1280 px, light and dark themes. This is **not** a substitute for the task-based test with real users (WS3.2) — the scripts for that session are in the appendix.

**Severity (Nielsen):** 1 cosmetic · 2 minor · 3 major (fix before the test round) · 4 catastrophic (fix immediately).
**Heuristics:** H1 visibility of system status · H2 match with the real world · H3 user control and freedom · H4 consistency and standards · H5 error prevention · H6 recognition rather than recall · H7 flexibility and efficiency · H8 aesthetic and minimalist design · H9 help users recognise, diagnose and recover from errors · H10 help and documentation.

## 1. Findings fixed in this round

| # | Area | Finding | Heuristic / WCAG | Sev | Fix (files) |
|---|---|---|---|---|---|
| F1 | School edit (server) | `PATCH /schools/:id` accepted **any** field from anyone with `EDIT_SCHOOL_PROFILE`, so a school leader could move the school's location or rewrite buildings. | H5, security | **4** | Field-level permission check; locked fields need a change request (`server/src/modules/schools/school-field-permissions.ts`, `schools.service.ts`). |
| F2 | School edit form | Every save re-sent `buildings`; the server deletes and recreates all buildings, losing KMZ footprints, 3D models, photos and notes. | H5 | **4** | Form now sends `buildings` only when the Buildings step was edited (`SchoolForm.tsx`). Server upsert still to do (R1). |
| F3 | School edit form | Step 1 (Basic info) was shown to users without `EDIT_SCHOOL_BASIC` because the form always opened on step 1; Cancel/Previous assumed step 1. | H5, H4 | 3 | Opens on the first section the user may edit; locked sections are listed with "Request a change" (`SchoolForm.tsx`). |
| F4 | Locked data | School leaders had no way to report a wrong location or building list. | H3, H9 | 3 | "Request a change" flow (WS7.7): dialog, `POST /schools/:id/change-requests`, request appears in Reports for GIS analysts, who can resolve it; the requester gets a notification (`RequestChangeDialog.tsx`, `ReportDetailsModal.tsx`, `Reports.tsx`). |
| F5 | Home page | School leaders landed on `/welcome` (or were bounced off the national dashboard). | H2, H7 | 3 | Role-based home (WS3.6): `/` sends school-tier users to their school dashboard (`App.tsx`, `homePathFor()` in `hooks/useScope.ts`). Login redirect is a handoff (R5). |
| F6 | Schools list | Upload-KMZ and Delete buttons were shown to every role (server returned 403). | H5, H4 | 3 | Row actions gated by permission; Edit and Request-a-change added (`SchoolsList.tsx`). |
| F7 | Schools list | Row actions only appeared on mouse hover — invisible to keyboard and touch users. | WCAG 2.1.1, H6 | 3 | Always visible below 1024 px; on desktop also on `focus-within`; every icon button has an `aria-label`. |
| F8 | Schools list (mobile) | 8-column table at 360 px forced horizontal scrolling. | WCAG 1.4.10 reflow | 3 | Cards below 768 px, table from 768 px. |
| F9 | Schools list | Export ignored the active filters; no way to keep or share a filtered view. | H7 | 2 | Export menu: current view (Excel/CSV) or full dataset; **Saved views** per user + "Copy link to this view" (filters already live in the URL) (WS3.10). |
| F10 | App shell (mobile) | Off-screen sidebar stayed in the Tab order; no Esc, no focus trap, no close button. | WCAG 2.1.2, 2.4.3 | 3 | Drawer with `role="dialog"`, focus trap, Esc, close button, `inert` when hidden, closes on navigation (`AppLayout.tsx`, `components/layout/useFocusTrap.ts`). |
| F11 | App shell | No skip link; nav/landmarks unlabeled; icon buttons without names. | WCAG 2.4.1, 4.1.2 | 2 | "Skip to content", labelled `nav`/`main`, `aria-current`, labelled hamburger/collapse/profile buttons. |
| F12 | App shell | Breadcrumb showed the raw URL segment ("3dview", "decision"); no way to jump between schools. | H1, H6 | 2 | Route-driven breadcrumbs with readable names + school switcher that keeps the current sub-page and respects scope (WS3.9, `components/layout/Breadcrumbs.tsx`, `SchoolSwitcher.tsx`). |
| F13 | Notifications | Bell showed a permanent "unread" dot and did nothing; report updates were a 5-second toast with raw text ("NEED INTERVENTION"). | H1, H2 | 3 | Bell with unread count, list, mark-all-read, links to the report; persisted per user; plain-language text via `lib/labels.ts` (WS3.11, `NotificationBell.tsx`, `notifications.ts`). |
| F14 | Onboarding | No help for first-time users. | H10 | 2 | 5–6 step guided tour per role (national vs school leader), shown once, re-openable from the Help (?) menu (WS3.7, `Tour.tsx`, `HelpMenu.tsx`). |
| F15 | Loading / empty / error | Failed loads looked like empty data ("No reports have been filed yet" after a network error); spinners with jargon ("Initialising GIS engine…"). | H1, H9 | 3 | Shared `EmptyState`, `ErrorState` (with retry) and skeletons applied to Schools, Reports, School reporting, National map, School detail, Welcome (WS3.8). |
| F16 | Reports | Rows and sort headers were mouse-only; status buttons shown to users who cannot triage (403 on click). | WCAG 2.1.1, H5 | 3 | Rows focusable (Enter/Space), sort headers are buttons with `aria-sort`, filter chips have `aria-pressed`; status buttons only for `MANAGE_REPORTS` (or GIS analysts on change requests). |
| F17 | Modal | No focus trap; every modal used the id `modal-title`; Esc closed all stacked modals. | WCAG 2.4.3, 4.1.1 | 2 | Focus trap with focus restore, unique ids, `aria-describedby`, Esc closes only the top modal (`components/ui/modal.tsx`). |
| F18 | Toasts | Live region was created per toast, so screen readers often missed them. | WCAG 4.1.3 | 2 | Persistent polite live region (`components/ui/toast.tsx`). |
| F19 | National map | Collapsed filter panel still focusable; priority toggles had no state; raw priority values. | WCAG 2.4.3, 4.1.2, H2 | 2 | `inert` when collapsed, `aria-pressed`, labelled select, `aria-expanded`/`controls` on the toggle, labels from `lib/labels.ts`; error and "no mapped schools" states. |
| F20 | Colour contrast | Light: muted text on muted background 4.34:1; destructive red 3.59:1. Dark: white text on primary buttons 3.51:1; focus ring 3.0:1. | WCAG 1.4.3, 1.4.11 | 3 | Tokens in `index.css`: light muted-foreground 43% L (≥4.99:1), destructive 46% L (5.35:1); dark primary-foreground navy (4.85:1), destructive-foreground navy (4.74:1), ring = primary (5.48:1). Global `:focus-visible` outline and `prefers-reduced-motion`. |
| F21 | Welcome | School leaders saw no relevant shortcuts; "Launch Module" text only on hover; empty case was an amber warning box. | H2, H6 | 2 | Role-aware quick links (My school, Report an issue, National dashboard…), visible focus, `EmptyState`. |
| F22 | School detail | Grey 40%-opacity text on white (< 3:1); tab bar overflowed at 360 px; error showed raw server text. | WCAG 1.4.3, 1.4.10, H9 | 2 | Darker text, scrollable tab group with `aria-pressed`, `ErrorState` with retry, skeletons, "Request a change" link. |

## 2. Remaining issues (not fixed in this round)

| # | Area | Finding | Heuristic / WCAG | Sev | Recommendation / owner |
|---|---|---|---|---|---|
| R1 | Schools service | Saving buildings still **deletes and recreates all buildings** (ids, footprints, `modelPath`, media, annotations lost) whenever `buildings` is sent. F2 only stops the form sending it by accident. | H5 | **4** | Server: upsert buildings by id (add `id` to `BuildingDto`, update existing rows, keep geometry/media, delete only removed ids); update `schools.service.spec.ts`. |
| R2 | School detail page | `pages/SchoolDetail.tsx` is not routed (`/schools/:id` redirects to `/decision`), so its tabs and the audit "Activity" section are unreachable. | H4 | 2 | Decide: route it (e.g. `/schools/:id/profile`) or merge its content into the decision dashboard. |
| R3 | Typography | Many labels use 9–10 px uppercase with wide tracking (Reports, Schools list, School reporting). Hard to read, especially on phones. | WCAG 1.4.4 (resize), H8 | 2 | Minimum 12 px for labels; sentence case for long labels. |
| R4 | School reporting | 2,359-line page: own ad-hoc toast and status modal, tab buttons not a real tablist, many `any` types. | H4 | 2 | Split into steps/components; use `useToast()`; `role="tablist"`. |
| R5 | Login | `Login.tsx` still sends non-school users to `/welcome` after sign-in instead of the national dashboard. | H7 | 2 | Handoff to Agent A: `navigate(homePathFor(data.user))`. |
| R6 | Dark theme | Primary buttons now use navy text on blue (for contrast). Check brand acceptance with RTB; some components hard-code `text-white` on `bg-primary` and still fail in dark mode. | WCAG 1.4.3 | 2 | Replace hard-coded `text-white` on `bg-primary` with `text-primary-foreground`. |
| R7 | Delete school | Uses `window.confirm` (inconsistent with the rest of the app, no description of consequences). | H4, H5 | 1 | Use `DeleteConfirmationModal`. |
| R8 | Settings ▸ Roles | ~~No indication which roles are built-in or presets~~ — **fixed**: role list shows access level and "Built-in" / "Preset"; built-in roles (incl. `gis_analyst`) cannot be dissolved. Remaining: role names are still shown in uppercase snake-case-derived text. | H6 | 1 | Use human role names from a label map. |
| R9 | KPI help | No "What does this mean?" for scores (WS3.5). | H10 | 2 | Planned in WS3.5 with the metric dictionary. |
| R10 | Charts | Status and priority colours carry meaning without text in some charts/legends. | WCAG 1.4.1 | 2 | Always pair colour with a label or pattern. |
| R11 | Change requests | Applying an approved change is manual (the analyst edits the record, then resolves the request). | H7 | 1 | Later: "Apply change" button that patches the proposed values and resolves the request in one step. |
| R12 | Accessibility testing | No automated axe run yet. | — | 2 | Run axe DevTools on every route in both themes before the WS3.2 session; target zero critical violations. |

## 3. Responsive check (360 / 768 / 1280)

| Page | 360 | 768 | 1280 | Notes |
|---|---|---|---|---|
| App shell | ✅ drawer, compact header | ✅ | ✅ | Breadcrumb shows only the current crumb/school below 640 px |
| Schools list | ✅ cards | ✅ table | ✅ | Toolbar wraps; sort controls hidden < 640 px (use column headers / defaults) |
| Reports | ✅ (location/category columns hidden) | ✅ | ✅ | |
| School reporting | 🟡 | ✅ | ✅ | Tab group now wraps; inner wizard still dense (R4) |
| National map | ✅ panel overlays map | ✅ | ✅ | Panel width `min(100vw-3rem, 340px)` |
| School detail | ✅ | ✅ | ✅ | Unrouted (R2) |
| Welcome | ✅ | ✅ | ✅ | |

## Appendix A — Scripted tasks for the user test (WS3.2)

Run with 3–5 users per role. For each task record: completed unassisted (yes/no), time, errors / wrong turns, and a one-line quote. Target: ≥ 80 % unassisted completion per task.

**Setup:** accounts per role on a test copy with the sample schools; one school with an open report; give users only the task text, not the steps.

### A.1 RTB officer (admin, national)
1. Find **[school name]** and tell us its condition score and priority.
2. Show only the **critical-priority schools in [province]**, save this as a view called "Critical [province]", then export it to Excel.
3. Open the reports that **need intervention** and mark one as resolved.
4. Find out **who changed** the location of [school] last week (Settings ▸ Audit).
5. Give a new colleague access as a **district officer for [district]** (create the user, choose the role and their district).

### A.2 GIS analyst
1. Upload the KMZ file for **[school]** and check that the buildings appear in the 3D view.
2. You received a **change request** — find it, check the proposed location against the map, apply it to the school record and close the request.
3. Measure the length of **Block A** in the 3D explorer and save the measurement.
4. Switch from [school A]'s 3D view to **[school B]'s** 3D view without going back to the list.
5. Find all schools **without GIS data** in [district] and copy a link to that list for a colleague.

### A.3 School leader
1. Sign in and tell us your school's **score** and its most urgent issue.
2. **Report a broken** [item] in [building], with a photo.
3. The school's map pin is in the wrong place — **ask RTB to correct it**.
4. Update the school's **phone number** and the number of female teachers.
5. Check whether your earlier report has been **handled** (use the notification or the history).

### A.4 Questions after the session (SUS-lite, 1–5)
- I could find what I needed without help.
- The words and labels made sense to me.
- I knew what the system was doing (loading, saving, errors).
- I would be confident using this without training.
