# DAYBRIDGE — PHASE-BY-PHASE GOOGLE AI STUDIO FOLLOW-UPS

## How to use these prompts
Start a **Web app** in https://aistudio.google.com/ and paste `DAYBRIDGE_MASTER_PROMPT.md` as the first Build-mode prompt. Provide `SUPABASE_SCHEMA.sql` as a companion reference if upload is supported; otherwise paste it when the database step is reached. If the project is generated in React/Vite instead of Next.js, use Prompt A immediately. After each phase, examine generated code and tests before continuing. Use these verbatim follow-up prompts **in order**. Do not connect production medical, court, or finance records until the isolated development project passes security testing. AI Studio's Publish option targets Cloud Run; for Vercel use GitHub sync/export.

### Prompt A — Confirm the target framework and repository
"Inspect the repository against DAYBRIDGE_MASTER_PROMPT.md. Confirm this is a Next.js App Router TypeScript app intended for Vercel, not Firebase/Firestore or a Cloud Run-specific Vite scaffold. If not, migrate it now while preserving the mobile UI. Produce a precise file tree, dependencies, `.env.example`, and local run instructions. Run the typecheck, lint and build, and report actual results. Do not claim any Supabase integration works until tested."

### Prompt B — Authentication and production-safe baseline
"Implement Phase 0 thoroughly: Supabase SSR integration with current documented auth verification, protected routes, single authorized owner onboarding, no public signup, email recovery, project-level security headers, RLS migrations, accessible navigation, skeleton/error/empty states and separate mock fixtures. Do not ask for or print secrets. Test anonymous and cross-owner authorization in an isolated development project. Report Supabase manual setup prerequisites."

### Prompt C — Scheduling, court and tasks
"Implement real persisted CRUD for calendar events, recurring instances, selected-day weekly court classes, therapy, case management, work shifts, attendance as self-reported only, travel preparation buffers, event conflict warnings and tasks. Test DST and edits to a single occurrence vs entire series. The Today dashboard should consume these real records. Keep routine actions within two taps. Show source files and actual tests."

### Prompt D — Budgeting and wage advances
"Implement money screens and pure financial calculations in integer cents, including manual confirmed account snapshots, transaction ledger, transfer pairs, bill instances, earmarked reserves, estimated and actual net paychecks, advance deductions, and conservative safe-to-spend. Prevent double-counting and show stale/manual balance warnings. Unit test negative account balances, pending transactions, duplicate bill payments, advances, transfers and changing payday. Use fictitious test data only."

### Prompt E — Medications and refill tracking
"Implement personal medication entries, scheduled daily/selected-day reminders, PRN records, dose logs with slot uniqueness, Taken/Skip/Snooze semantics and optional inventory/refill reminders. Never infer adherence from absent clicks. No medical advice. Lock-screen content must remain generic. Test duplicate taps, time zones and midnight rollover. Ensure only the owner can access this data."

### Prompt F — Notifications and biometric sign-in
"Implement persistent Supabase SSR sessions, experimental passkey enrollment/sign in with documented SDK guards, email backup recovery and clear unsupported-device fallbacks. Add installed-PWA manifest/icons, push subscription opt-in, generic messages, a robust idempotent Supabase Cron → authenticated Edge Function reminder worker, self-test notification and calendar/ICS fallback. Never use Vercel Hobby per-minute cron. Test on a real production-origin domain only when configured; report all unverified claims."

### Prompt G — Reports, resources and settings
"Implement self-reported weekly review with selective privacy-preserving export/print, the owner-entered resource contact list, privacy/quiet hours/accessibility settings, data export and deletion process, clear installation guide, and clear account security instructions. Reports must include a disclaimer that they are not official court attendance verification."

### Prompt H — Security, QA and deployment readiness
"Run the complete acceptance-test list in DAYBRIDGE_MASTER_PROMPT.md. Verify zero secrets in frontend, owner RLS across all tables and composite relationships, secure sessions, blocked public signup, protected Vercel previews, safe push contents, accessibility, build, database advisors, and safe data handling when offline. Explain any failed/unexecuted check. Generate `TESTING.md`, `SECURITY.md`, `PRIVACY.md`, `KNOWN_LIMITATIONS.md`, `README.md`, and `ASSIGNMENT_SUMMARY.md`. Prepare the private GitHub project for Vercel import without publishing real data or deploying prematurely."

## Manual setup checklist the owner performs (never post actual credentials in AI chat)

1. Create a **new Supabase project** dedicated to private personal data. Separate it from any public business project.
2. In project Auth settings, disable public signups. Manually create/confirm the sole authorized account. Choose secure recovery email.
3. Run reviewed migrations in dev first, verify RLS; promote tested migrations to production.
4. Set approved site/redirect origins for local development and custom production domain.
5. Choose a **stable custom domain** before registering passkeys and configure its WebAuthn RP ID/origins. Supabase passkeys are experimental and must be explicitly enabled.
6. Privately configure Vercel environment variables. Browser-only: Supabase URL and publishable key. Server-only: only narrowly scoped secrets required for approved operations.
7. Configure Supabase Cron/Edge Functions and their Vault-held invocation credentials. Test idempotent dispatch and generic push messages; check notifications on actual phone.
8. Link private GitHub repository to Vercel, protect previews, run tests, deploy approved revision, verify on Android/iOS and inspect logs for sensitive leaks.
9. Establish a recurring secure backup/export plan, test restore and lost-device recovery.

## Architecture assertions that should never be lost
- This is a **single-user** life-supporting organizer for personal use, not a patient portal or official court tool.
- Privacy and robust usability outrank flashy AI features.
- Supabase is the only live backend; Vercel is the only target hosting platform.
- Login can stay persistent; passkey is supported with a reliable fallback; biometrics are owned by the OS.
- Nothing counts as an officially verified court attendance or clinically validated adherence record.
- No 'real data' claim for UI using placeholder records.
- No timed-push guarantee when offline, the device is in restrictive power mode, or permissions are blocked.
