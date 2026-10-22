# DAYBRIDGE — MASTER GOOGLE AI STUDIO BUILD INSTRUCTION

**Project:** DayBridge Personal Edition
**Purpose:** A secure, genuinely usable daily-life management application for one person completing an accountability court assignment. The app must also be practical to use every day, especially when tired, distracted, short on time, short on money, or overwhelmed.
**Target:** Private, mobile-first, installable Progressive Web App on Vercel with Supabase as the sole operational backend.
**Core mandate:** Every recurring daily action should usually be reachable and complete in one or two taps. Reduce cognitive load rather than adding data-entry chores.

> YOU ARE THE LEAD ENGINEER, PRODUCT DESIGNER, DATABASE ARCHITECT, ACCESSIBILITY ENGINEER, AND SECURITY REVIEWER. Implement the project in real code, not a static mockup. Treat this document as the product contract. Build incrementally, run checks, correct errors, and report what works and what remains blocked. Never represent demo data or unimplemented functions as live features. Do not deploy or process real medical or court data before completing security validation.

## 0. Platform and absolute constraints

1. Generate a full **Next.js App Router + TypeScript** codebase suitable for **Vercel**, using React, Tailwind CSS, shadcn/ui-style accessible components, Lucide icons, Zod validation, react-hook-form, and a sensible data-fetching/cache layer.
2. **Supabase only** for Auth, PostgreSQL, RLS, Storage if required, Edge Functions, and Cron. DO NOT silently create Firebase, Firestore, a second database, a third-party auth service, or Google Cloud deployment. If the AI Studio preview runtime cannot run Next.js, state that limitation and create/export a fully runnable Next.js repository instead. Never redesign it as a Vite-only application without explicit approval.
3. The app has **one authorized human user**, not an organization. No public onboarding, self-service account creation, referrals, case manager portal, clinician portal, organization, or role management. A manually provisioned Supabase Auth account signs in, then registers a passkey. Support multiple personal devices attached to that single identity.
4. Zero required Gemini/AI calls: the app must work without AI APIs, cloud model inference, or paid AI features. Any future AI assistance is opt-in, disabled by default, and must not send medical, financial, or court information to models without explicit consent.
5. Enforce private application access end to end, including all pages, database queries, API routes, exports, notifications, and file storage.
6. Do not presume official accountability court rules. Times, attendance requirements, activities, coordinators, and deadlines are **user-entered**. Attendance is **self-reported** and never described as officially verified.
7. Medication tracking is a personal log, not medical advice. Never change prescribed doses, recommend medication changes, infer that a dose was taken, or equate an unanswered reminder with a confirmed missed dose.
8. Privacy-by-default: hide sensitive subjects on lock-screen push notifications; don't use advertising, trackers, or analytics that transmit private page content.
9. Do not hardcode private details or hypothetical budget amounts. Demo mode is separate, uses clearly labeled fictitious data, and cannot mingle with real data.
10. Don't request passwords, secrets, service-role keys, or medical details in the chat. Provide `.env.example` with names and setup instructions; credentials are set privately by the owner in secure deployment settings.

## 1. Product promise and acceptance target

The homepage answers in 5 seconds: **What do I have to do next? Did I take my scheduled medication? What can I safely spend? What must I prepare for tomorrow?**

Design principles:
- Calm, nonjudgmental, respectful wording. No shame-based streaks, punishment colors, or coercive language.
- Progressive disclosure: four simple tabs first; advanced details hidden until requested.
- One shared `Quick Add` command: appointment, court class, work shift, medication, bill, income, expense, task, refill, or personal note. Intelligent forms reveal only relevant fields.
- Large 44x44px minimum tap targets, visible focus, keyboard navigation, screen-reader labels, WCAG 2.2 AA contrast, reduced-motion support, readable typography, light/dark/automatic themes, and adjustable text size.
- Optimized for 360px Android screens and works on iPhone, tablet, and desktop.
- Financial values always distinguish real balance, estimated commitments, and forecasts.
- Never use 'all done' unless all explicitly tracked items are completed; instead say 'Nothing else scheduled right now.'
- Any unfinished onboarding step can be skipped and completed later.

## 2. Design system and app layout

App name **DayBridge**. Identity: understated navy/charcoal text, teal accent, warm neutral surfaces, restrained amber warnings, accessible success states, no excessive gradients or visual noise. Professional and comforting, not a medical institution's portal. Prefer native-feeling cards, skeleton loading, bottom sheets, dialogs for destructive actions, toast confirmation + undo where safe.

Phone navigation: **Today | Schedule | Money | Health | More** with floating/center `+` quick-add if it does not obstruct content. Desktop uses matching sidebar. Court appears as a first-class filter within Schedule and a 'Court & Classes' area under More. Today is the default landing route on every device.

### Screen map (all protected except auth/recovery):
- `/login` — email magic-link/OTP fallback, passkey sign in when enrolled, clear setup instructions.
- `/setup` — initial preferences and checklist. Ask timezone, preferred quiet hours, reminder behavior, budget account initial balance, next payday, relevant repeating obligations, optional meds. No forced medical disclosure.
- `/today` — greeting, next obligation card, dose actions, money availability, 3 top tasks, tomorrow preview, one-tap quick-add. Has a small sync/notification status indicator.
- `/schedule` — agenda/list and calendar views (day/week/month), tabs All/Court/Work/Therapy/Case Management/Other, event editor, recurrence, reminder and travel buffer preferences, conflicts.
- `/schedule/[id]` — event details, self-reported attendance status (attended/not attended/unconfirmed), location/link and preparation checklist; no fake official verification.
- `/court` — court-oriented agenda and checklist with classes, appearances, due items, self-reported attendance and weekly summary link. Court compliance is not computed as an official score.
- `/money` — available-to-spend prominently, cash/account balances (manual), reserve-for-gas control, bills before payday, recent transactions, next payday, forecast warnings.
- `/money/transactions` — add/edit/delete income/expenses/transfers with accessible category picker, dates, and notes.
- `/money/bills` — recurring bills/expenses with due dates, autopay status (informational only), mark paid action and safeguards against double counting.
- `/money/pay` — net paycheck plans, wage advances, expected remaining paycheck, reconciliation workflow.
- `/health` — medication list, due medication cards and dose log, refill outlook, healthcare appointment shortcut.
- `/health/medications/[id]` — manually configured instructions, days/times/timezone, optional inventory, dose history and refill reminder; concise caution: follow prescription label/provider instructions.
- `/tasks` — today/upcoming/backlog, one-tap completion, recurring tasks, smart preparation checklists.
- `/review` — printable/exportable weekly self-review: scheduled/attended/self-reported classes, medication **logged** doses (not inferred adherence), completed tasks, cashflow, expenses, upcoming needs; user can edit notes and manually choose what to export.
- `/resources` — personally saved contacts, pharmacy, treatment providers, transportation, food assistance, court contact info, emergency planning. Save only user-supplied details. One-tap calling/copying, no unsolicited outreach.
- `/settings` — profile/timezone, notifications, quiet hours, privacy mode, theme/accessibility, data export/import, export data deletion, device management link, account sign-out, test notifications, install PWA guide, security diagnostics.
- `/offline` — honest offline support screen, never pretend sync completed if not.

### Today screen priority algorithm
1. Critical upcoming user-configured appointments/events in the next 24h, sorted by start time, plus travel preparation buffer.
2. Current medication schedule slots due within user-configured window (show `Taken`, `Snooze`, `Skip` separately, never auto-log a dose as skipped).
3. Bills due before next confirmed paycheck and funds reserved for essential transportation/food.
4. The next three incomplete time-sensitive tasks.
5. Tomorrow preview and one compact 'This week' row.
A conflict warning appears only if obligations actually overlap or arrival buffer is insufficient.

## 3. Core end-to-end workflows

### A. Unified scheduling and accountability
- Quick Add > choose Therapy, Case Management, Court/Class, Work, Personal, or Other.
- Save title, start/end, IANA timezone, physical/virtual venue, optional URL, contact, recurrence rules, reminder offsets (default e.g. day before + 2h + 30min for appointments, all editable), travel buffer, and optional preparation checklist.
- Recurrences must support weekly selected days, interval, ending date, exceptions and edits to **one occurrence** versus **entire series**.
- Account for daylight saving via local wall-clock recurrence and UTC materialized occurrences. Default timezone `America/New_York` but user-editable.
- Detect overlaps and potential conflicts with work and court; don't silently move anything or claim third-party appointments were rescheduled.
- Attendance states: `unconfirmed`, `attended_self_reported`, `not_attended_self_reported`, `cancelled`. Record who entered status (always owner), timestamp, and optional note; never present 'attended' as externally verified.
- For events that need external confirmation, create a 'Contact provider' reminder, not an automatic rescheduling claim.

### B. Medication management
- Name, strength text, label instructions, optional prescribing clinician/pharmacy, PRN flag, start/end, selected weekdays, daily dose times, reminder settings, inventory (optional), refill threshold, refill date and notes.
- Due dose card: one tap `Taken` (records actual tap time and intended slot), `Snooze` (changes reminder only), or `Skip` (self-reported reason optional). `Dismiss reminder` must **not** log a dose.
- Confirm when logging a second `Taken` for same scheduled slot; enforce one active dose log per schedule slot. PRN use is manual and must not infer safe intervals or dosages.
- Overdue unacknowledged slot stays `No entry recorded`, **not** 'confirmed missed'.
- Refill reminders from user-entered date or deterministic optional inventory estimate. Label estimates clearly. No pharmacy automation or prescription ordering in MVP.
- Do not send drug names or therapy-specific terms in push notification payload or lock-screen text.

### C. Money and conservative availability
- Start from user-confirmed current balances (manual accounts: checking, cash, optional savings). This is a ledger, **not bank syncing**.
- Transactions use integer cents, signed amounts, posted/pending distinction, categorization, date, notes, optional transfer linking. A transfer must not count as income or spending across the aggregate.
- Paycheck plan stores expected **net** amount, next payday, recurring pay period, and confidence of estimate. Enter wage advances as money received now; mark them explicitly as **part of** the upcoming paycheck and deduct from estimated remaining payday deposit. Never count both advance and original full paycheck as spendable cash.
- User-adjustable categories: fuel/transport, groceries, housing, phone, prescriptions, court-related travel, other. No assumptions about real income or schedule.
- Bills: recurring due date, amount, due date overrides, auto-pay flag, paid/unpaid. Mark Paid should optionally create a corresponding posted expense; prevent duplicates.
- Earmarked reserves: gas, food, upcoming bills, optional emergency buffer. Reserve allocations earmark current money; they are **not expenses**.
- **Safe-to-spend calculation:** confirmed aggregate available checking/cash balance (accounting for posted transactions) MINUS unpaid bills due before next confirmed paycheck MINUS earmarked reserves not already represented by those bills MINUS user-configured emergency buffer. Clip display at `$0` while separately showing shortfall as a negative amount. Do not include projected paychecks in current available balance. If data stale/unconfirmed, display 'Estimate — check your account' rather than financial certainty.
- Quick view: 'What can I spend on gas/food until payday?' Show remaining category reserve and dates, not personalized financial advice.
- Reconcile after paycheck deposits using actual net and actual advance deductions.
- Budget stats include cashflow by week, category totals, committed bills, over/under estimate and an explicit 'manual records' banner.

### D. Tasks and preparation
- One-tap tasks, repeat rules, deadlines, priorities, linked events, optional notes and checklist subtasks.
- Auto-suggest **non-automatic**, reviewable preparation tasks from events: 'check transportation', 'bring documents', 'confirm appointment'. User chooses whether to create them. Never create unsanctioned obligations or contacts.
- Snoozing a task doesn't change the actual event time.

### E. Weekly review and export
- User selects date range, categories to include and redaction options. Render attractive printable report; support browser Print > Save PDF and CSV export where appropriate.
- Header: 'Personal self-reported weekly organization summary — not an official court attendance record'.
- Show scheduled activities, user-logged attendance, recorded medication log actions (option to omit names), spending and reminders, upcoming week. No subjective 'court compliance score' or automatically generated assertions about sobriety/treatment success.
- Exports generated only on explicit user action. No auto-sharing/emailing.

## 4. Authentication, secure sessions, and device behavior

- Provision ONE Supabase Auth account manually. Disable public user sign-up. Email magic-link/OTP or password fallback for initial bootstrapping and recovery. After login, register a passkey through Supabase's **experimental** passkey support if enabled; show support status and non-passkey fallback when unsupported. Confirm current SDK version/docs before coding; explicitly opt in if required.
- Pick a permanent WebAuthn relying party ID on a stable production custom domain **before passkey registration**, since a change can invalidate passkeys. Do not require passkeys to work inside the temporary AI Studio preview origin.
- A passkey proves the user through device biometrics, device PIN, or supported authenticator; never store fingerprint or face data and never insist that every device will specifically use a fingerprint.
- Persistent Supabase SSR cookie/session with correct rotation and secure refresh. User remains signed in across app openings unless revoked or expired. Log out on explicit request, stop using lost devices, support remote revocation instructions.
- Use current `@supabase/ssr` integration, cookies with secure settings, and verified `auth.getClaims()`/`getUser()` on server. Do not trust raw `getSession().user` for server authorization. Do not cache authenticated responses across users. Ensure sensitive pages have `Cache-Control: private, no-store` where appropriate.
- Optional privacy curtain after 5/15/30 min inactivity, and on foreground: this is visual privacy only unless backed by actual passkey reauthentication; don't claim a CSS/JS overlay secures API requests. For protected unlock, require a fresh verified passkey sign-in/re-auth flow. A device using OS lock can keep the session while hiding details in task switcher as feasible.
- Clear local sensitive caches and subscriptions on explicit logout; delete locally stored offline data when requested.
- Recovery: email verified recovery, re-register passkey, invalidate lost device session. Never create a bypass master password in source.

## 5. Threat model & security implementation (must not be skipped)

Assets: prescription names/dose histories, therapy/case-management schedules, accountability court activity records, budget balances, addresses, saved contacts, auth cookies, offline caches, document attachments.

Threats: lost phone, stolen refresh token, public preview deployments, overly permissive RLS, IDOR across users, unauthorized signup, XSS, CSRF, subscription spoofing, sensitive payloads in push notifications, verbose logs, data appearing in web cache, malicious upload, backup leakage and accidental share/export.

Mandatory controls:
1. RLS on **every** Supabase-exposed table; per-record owner predicate `user_id = (select auth.uid())` for SELECT/INSERT/UPDATE/DELETE. INSERT requires `WITH CHECK`; UPDATE requires both `USING` and `WITH CHECK`. Ensure foreign key parent record belongs to same owner via composite FK or trusted server validation. Do not rely on 'authenticated' alone.
2. No privileged database keys in the browser or `NEXT_PUBLIC_` variables. If a privileged key is genuinely needed for scheduled jobs, read it only in isolated, authenticated server/Edge runtime. Prefer least privilege and minimize use.
3. Use separate private schema for server-only notification dispatch and security/audit operations; do not expose security-definer routines or privileged RPCs in `public`.
4. Zod validation at each input boundary, parametrized queries/client SDK, output escaping, Content Security Policy, security headers, request size limits, route/auth checks, signed webhook/cron invocations, and rate limits where appropriate. Avoid unsafe `dangerouslySetInnerHTML`.
5. HTTPS and modern transport security. Supabase managed at-rest protections plus minimal collection. Do **not** claim end-to-end encryption unless implemented and tested. Optional high-sensitivity client-side vault can be a later phase, with independently reviewed key management.
6. Strictly private Supabase Storage buckets if document attachments are added. Server-validated MIME/size, optional malware scanning before availability, time-limited authorized URLs; no public buckets for court/health documents.
7. No actual medication names, therapy descriptions, financial amounts, contact details or court records in exception logs, analytics, URLs, referrers, notification payloads, or build-time outputs. Disable unnecessary third-party telemetry.
8. No public shared demo containing the actual profile. Preview deploys must be deployment-protected or use only fake data.
9. Do not store web push subscription endpoint/access tokens in logs. Restrict subscriptions by authenticated owner.
10. Add export-data and delete-account/data affordances (with confirmation and documented recovery implications), backups/recovery plan, and a simple privacy statement explaining third-party infrastructure.
11. Verify with at least two real distinct Supabase test users in a **separate development project** that User B cannot select/insert/update/delete User A's records, and unauthenticated requests are rejected; then remove/disable test accounts from private production.
12. Security verification is a release gate, not an optional checklist. Document unresolved risks honestly.

## 6. Database design and migrations

Use the accompanying `SUPABASE_SCHEMA.sql` as the **starting executable migration**, not as a substitute for review. It covers these entities:
- `profiles`: owner identity and personal settings.
- `calendar_events`, `event_occurrences`: normalized local/UTC schedule rules and self-reported occurrence status.
- `tasks`: manually entered or linked preparation actions.
- `medications`, `medication_schedules`, `medication_logs`: scheduled and PRN dose tracking with unique slot protection.
- `budget_accounts`, `money_transactions`, `paycheck_plans`, `wage_advances`, `bills`, `budget_reserves`: transparent manual budgeting.
- `reminder_rules`, `reminder_occurrences`, `push_subscriptions`: scheduling and opt-in web push.
- `resource_contacts`: optional private list.

Refine fields through versioned Supabase migrations, not manual schema edits only. Strong ownership-aware foreign keys, not-null and CHECK constraints, integer cents, indexes on owner and due times, UTC timestamps, IANA timezone fields. Store recurrence as RFC 5545 RRULE plus timezone and optional exception list; generate/update materialized occurrence rows for next 30–60 days. Store `created_at`, `updated_at` consistently; use client-generated UUID for offline-safe idempotent writes where possible. Migrations must be idempotent only where safe and must not quietly delete data.

Derived data (safe-to-spend, medication status, weekly metrics) should be computed in pure, tested application functions rather than duplicating inconsistent counters in tables. For security, avoid publicly callable `SECURITY DEFINER` shortcuts.

## 7. Reminders and notification pipeline

- Permission must be requested from an explicit user gesture on a supported browser, not automatically during loading or onboarding.
- PWA manifest with icons, name, standalone display and stable start URL; service worker manages only static shell/assets and explicitly safe cached data. No plaintext sensitive health/court/budget API response caching by default.
- Reminder templates from appointments, meds, tasks, refills and bills; materialize reminder occurrences with `due_at` UTC, owner ID, kind, source reference, `dedupe_key`, state, attempt info. Reconcile 30–60 days ahead and after edits; cancel invalid future rows.
- Prefer **Supabase Cron once a minute → authenticated Supabase Edge Function** for push dispatch (and optionally a separate occurrence materializer job). Do not depend on Vercel Hobby per-minute jobs. Protect worker invocations via secret/Vault and do not create a public unrestricted notification endpoint.
- Worker claims due reminders atomically; idempotent send keyed on event+slot+offset+destination; concurrent retries must not create duplicate notifications. Retain delivery attempts without detailed personal data. Honor quiet hours, user settings and priorities; never attempt to bypass OS Do Not Disturb.
- Push payload generic: 'DayBridge reminder — open to view' with minimal reference routing, no detailed description. Notification click navigates to app after user verifies session.
- Distinguish 'queued', 'sent to push service', and 'shown/read' — successful server transmission doesn't guarantee OS delivery. Show health/status diagnostics and 'send test reminder'. Handle expired subscriptions safely.
- For time-critical medication/court reminders, provide **an optional device-calendar/ICS backup** and show a reliability warning: a PWA/web push cannot guarantee delivery on time or offline. Test real devices, permissions, battery restrictions and background modes.
- In-app due reminders must work while the app is open even if push is blocked. Snooze only reminder instance; never alter the prescribed medication schedule.

## 8. Offline and synchronization strategy

**Release 1:** installable offline app shell; previously loaded *non-sensitive summary/navigation* may be shown if safely cached; do not cache plaintext prescriptions, detailed therapy/court records or money entries. When offline, clearly indicate connection loss and which actions cannot be safely synced. Do not fake saves.

**Release 2 (after security review):** encrypted IndexedDB local store and bounded write queue, versioned records, idempotency keys, retry on reconnect, conflict notification, `last_synced_at` UI. If storing sensitive local data, use reviewed key management (e.g. a separate user-provided strong passphrase and WebCrypto authenticated encryption); biometrics alone in a web app cannot be assumed to decrypt offline data on all platforms. Test crashes, duplicate events, concurrency and logout wipe. Do not cache auth cookies/refresh tokens in offline store. In a compromised browser/XSS, client-side encryption is not an all-purpose defense.

No silent overwriting of schedules/medication logs in conflicts; display review. No unreliable promise that notifications fire when fully offline.

## 9. Data/services/module organization

Suggested structure (adjust framework files for current Next.js release):
```
app/
  (public)/login/page.tsx
  (protected)/layout.tsx
  (protected)/today/page.tsx
  (protected)/setup/page.tsx
  (protected)/schedule/page.tsx
  (protected)/schedule/[id]/page.tsx
  (protected)/court/page.tsx
  (protected)/money/page.tsx
  (protected)/money/transactions/page.tsx
  (protected)/money/bills/page.tsx
  (protected)/money/pay/page.tsx
  (protected)/health/page.tsx
  (protected)/health/medications/[id]/page.tsx
  (protected)/tasks/page.tsx
  (protected)/review/page.tsx
  (protected)/resources/page.tsx
  (protected)/settings/page.tsx
  offline/page.tsx
  api/notification-subscriptions/route.ts
  api/export/route.ts
components/{layout,today,schedule,money,health,tasks,common}/
lib/supabase/{client,server,proxy-or-middleware}.ts
lib/{auth,budget,recurrence,medication,reminders,security,validation,date-time}/
supabase/migrations/
supabase/functions/dispatch-reminders/
public/{manifest.webmanifest,icons/,service-worker.js}
tests/{unit,integration,e2e,security}/
.env.example
README.md
SECURITY.md
PRIVACY.md
```
Follow the currently documented `proxy.ts` vs `middleware.ts` convention for the chosen Next.js version. Implement a clean repository with strict TypeScript, eslint, prettier, lockfile and a `build` that works on Vercel.

### Domain APIs and contracts
- `getTodayOverview(userId, now, timezone)` -> {nextEvent, medicationDue[], safeToSpend, urgentTasks[], tomorrowPreview, syncStatus}
- `expandRecurrence(event, range, timezone, exceptions)` -> deterministic event occurrence slots with DST tests.
- `recordDose(scheduleId, occurrenceUTC, action, recordedUTC, requestId)` -> idempotent, duplicate-checked self-report only.
- `calculateAvailableMoney({confirmedBalances,unpaidPrePaydayBills,distinctReserves,buffer})` -> money in integer cents; no forecast double counting.
- `calculateRemainingPaycheck({expectedNet, linkedAdvanceAmounts})` -> clamp displayed remaining at zero but show deficit/overadvance if any.
- `createOrUpdateEvent`, `recordAttendance`, `createTransaction`, `reconcilePaycheck`, `completeTask`, `createWeeklyReview`, `registerPushSubscription`, `dispatchDueReminders`.
- Input validation includes amount ranges, dates/times, empty names, nullable end dates, recurrence loops, DST ambiguity handling, bank negative balances, cross-owner references, phone/text lengths, huge uploads and malicious payloads.

## 10. Explicit acceptance tests

### Critical user flows
1. An initially blank account can finish minimal onboarding in less than 3 minutes with most optional questions skipped.
2. Add a recurring Wednesday accountability class once; see each Wednesday on schedule, today panel when due, and calendar conflict warnings.
3. Log `attended_self_reported` for one occurrence without marking future occurrences attended.
4. Add two therapy appointments, adjust only one occurrence, preserve the recurring series.
5. Add a medication with a morning and evening schedule; log morning as Taken, ensure evening stays untouched. Snooze changes no dose history. Repeating Taken for same slot warns/prevents duplicate.
6. Add next paycheck, record an advance as early paycheck cash, verify the remaining paycheck projection doesn't double count it.
7. Start with a manual $150 confirmed balance, unpaid $60 bill, earmarked gas $35, grocery $30, buffer $10: safe-to-spend = $15 (assuming no overlapping reserves); expenses update this correctly.
8. A transfer between checking and savings changes account balances but not total spending.
9. Create an event overlapping a work shift and get a precise conflict explanation.
10. Push permission denied -> in-app status and calendar fallback offered, no false 'reminders active' indicator.
11. Test notification button sends a generic notification on a supported installed PWA. Shows limitations where unsupported.
12. Install on Android and iPhone; independent device layout works. Passkey enrollment is performed on stable production origin, not preview.
13. Sign out, refresh and attempt protected pages/routes and Supabase data API access -> denied. Remote session revoke behaves as documented.
14. Test two authenticated users in isolated development: B cannot access A's data even by modifying UUIDs; insert/update parent foreign keys belonging to other owner also rejected.
15. PDF print contains the explicit personal/self-reported disclaimer and supports selectively omitting medication information.
16. App remains usable with slow network, loading errors, no medication record, no money data, and no scheduled events. Empty states are useful.
17. DST tests: weekly 9 AM in America/New_York stays 9 AM local before and after transitions.
18. Destructive actions ask for confirmation; exported files contain only selected user's records. Manual delete properly clears relevant local cache.
19. There are no real user's records in public build logs, SEO metadata, push notification payloads, analytics or Vercel preview screenshots.
20. No silent mock backend: every Save is either persisted/acknowledged or clearly flagged as unsaved.

### Automated gates
- Unit tests: budget arithmetic, advances, dedupe, recurring dates, medication slot logs, weekly report totals, input validation.
- Integration: schema constraints, owner-scoped foreign keys, Supabase RLS in separate test project, protected routes.
- E2E using Playwright: onboarding, CRUD for all major modules, navigation and mobile viewport, accessible form control validation.
- Static checks: `tsc --noEmit`, lint, dependency audit, secret scan, build, Supabase advisors, privileged RPC/storage policy review, accessibility checks.
- Disaster drill: backup/restore procedure for owner-export and account recovery. No claim of backup success unless verified.

## 11. Milestones (ship useful stages, no premature polish)

**Phase 0: Repository & security baseline.** Next.js, accessible design system, protected routes, Supabase SSR Auth, `.env.example`, RLS migration, test framework, no real data; owner manual provisioning, no public signup.

**Phase 1: Useful daily MVP.** Today, Quick Add, tasks, calendar/court/classes/work, money accounts/transactions/paycheck advances/bills, medication schedule + dose logs. Real CRUD, validations and responsive design.

**Phase 2: Reminders & passkeys.** Passkey register/sign-in on real stable domain; persistent verified sessions; web push subscription; server-side due scheduler; generic payloads, delivery diagnostics, ICS fallback, test on devices.

**Phase 3: Weekly review & personal resources.** Self-reported attendance, printable/redacted report, saved resources/contacts, export/delete, accessibility polish.

**Phase 4: Resilience & hardening.** Advanced encrypted offline support only when threat model/key management pass review, security e2e tests, proper failure states, CSP tuning, deployment verification, data migrations/backups.

Stop at an honest functional boundary if external keys/settings are missing, and provide the exact next manual step without faking completion.

## 12. Deployment and handoff

- Develop in **Google AI Studio Build mode** and sync to a new private GitHub repository. Google AI Studio's native one-click deployment is Cloud Run; **do not use that** for this architecture. Import the repository into Vercel for previews/production.
- Deploy to Vercel with separately configured Supabase URLs and publishable keys, allowed auth redirects, trusted production custom domain, and WebAuthn RP origin. Never output secrets.
- Use a fresh isolated Supabase project (or explicitly separate, security-reviewed schema/project) rather than mixing sensitive personal app data into an existing public product database. Create a dedicated private project, configure manual user provision and restricted signups.
- Ensure **real Supabase data** is required for production. Demo mode uses in-memory/fake fixtures only and cannot execute production writes.
- Publish documentation: `README.md` setup/installation, `SECURITY.md` threat model and security test results, `PRIVACY.md`, database migrations, `TESTING.md`, `KNOWN_LIMITATIONS.md`, and a concise `ASSIGNMENT_SUMMARY.md` describing the original homework and measurable friction reduction.
- Verify Vercel preview protection, production authentication flow, Google/Apple mobile install behavior, actual scheduler delivery and device timezone settings.

## 13. Instructions for how you should execute this build NOW

1. Read the full specification and the accompanying SQL/milestones. Acknowledge architecture and identify external configuration prerequisites. Do **not** ask product discovery questions; sensible decisions are specified here.
2. Create the actual Next.js repository and implement Phase 0. If preview cannot execute it, generate the repository/exportable files regardless.
3. Continue with Phase 1 in logical feature slices, always writing functional state/database logic, not just cards and placeholders. Compile/typecheck/tests after each slice.
4. If context or execution limits prevent completion, report exactly what is implemented, with filenames and test results, then state the next prompt to continue; do not say complete unless all gates pass.
5. Use follow-up phase prompts in `BUILD_SEQUENCE.md` for subsequent passes. Do not invent deployed URLs, installed passkeys, sent notifications, passed security checks, or linked Supabase projects.

### Finish condition
The project is complete only when it is an installable, private, real-data PWA; schedule, budget, medication and tasks genuinely persist; sessions and RLS work; reminders have an actual operating backend or explicitly marked degraded fallback; end-to-end tests pass; and the owner can use it on their phone without developer intervention for routine actions.

## Current source references to consult during implementation
- Google AI Studio Build mode: https://ai.google.dev/gemini-api/docs/aistudio-build-mode
- Supabase SSR Auth: https://supabase.com/docs/guides/auth/server-side
- Supabase Passkeys (experimental): https://supabase.com/docs/guides/auth/passkeys
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Cron: https://supabase.com/docs/guides/cron
- Supabase function scheduling: https://supabase.com/docs/guides/functions/schedule-functions
- Vercel Cron limitations: https://vercel.com/docs/cron-jobs/usage-and-pricing
- iOS installed PWA push: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

Do not copy obsolete API examples; consult live package docs and Supabase changelog before implementing potentially changing authentication or cron interfaces.
