# DayBridge Personal Edition

A private install-first PWA for one person's daily budgeting, medications, therapy, case-management, accountability-court classes, and tasks.

## Architecture
- Next.js 15 App Router + TypeScript + Tailwind v4; deployed on Vercel
- Supabase Auth, persistent secure browser session, optional experimental WebAuthn passkeys
- Supabase PostgreSQL (17 normalized domain tables plus `private_snapshots`)
- Live UI currently persists a single JSON snapshot per signed-in owner using Supabase RLS. The normalized tables are **prepared for a future migration**, not yet used by the UI.
- Light-only, accessible navigation with grouped and collapsible side menu
- Install-first screen for supported Android/iOS/desktop PWAs
- A push-only service worker that does **not** cache protected screens or private records

## Setup
1. Use the dedicated Supabase project. Apply the migrations in `supabase/migrations` if not already applied. For the owner's existing project these were applied on 2026-10-21 (America/New_York).
2. In Supabase Dashboard, disable public sign-ups (Authentication > Providers > Email), create/invite **only your own account**, and require email confirmation. Keep MFA available.
3. Configure the **production domain** in Supabase Auth URL configuration and the WebAuthn Relying Party settings. Passkeys are experimental; avoid changing the RP ID after enrollment. Enable passkeys in Dashboard only when the permanent HTTPS domain is known.
4. In Vercel, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. These are public configuration values, not secrets. Never expose Supabase service/secret keys to the client.
5. Optional remote Web Push setup needs `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in Vercel **and a separate authenticated delivery worker with VAPID private key**. No delivery worker is present yet, so do **not** rely on automatic scheduled notifications.
6. Install the PWA from the device's browser, open the home-screen icon, sign in, then optionally register your passkey and enable device notification permission in Settings.
7. Test across Android Chrome/Samsung Internet and iOS Home Screen. On iOS, no JavaScript API can force an install prompt; the app shows manual instructions.

## Local
```bash
npm install
npm run typecheck
npm run build
npm run dev
```

## Security assumptions
- Never enter real medication, therapy or court data in a preview URL or unaudited deployment.
- The app currently stores authenticated personal records in Supabase `private_snapshots`, not browser localStorage. Data is encrypted in transit and relies on Supabase platform-level encryption at rest; it is **not end-to-end encrypted**.
- JSON export is **unencrypted** and must be protected.
- PWA installation is a UX prerequisite, not an authentication or authorization security boundary.
- The service worker doesn't implement offline access to personal records. Existing local data from old builds requires a deliberate manual migration; this build doesn't silently copy it.
- Concurrent edits from multiple devices are last-write-wins, and failed saves require retry. Use one primary device until conflict detection and a persistent offline queue are implemented.
- App-entered attendance is self-reported, never official court verification.
- For health decisions, always follow clinician instructions and prescription labeling.

See `SECURITY.md` and `KNOWN_LIMITATIONS.md`.
