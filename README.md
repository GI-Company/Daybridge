# DayBridge Personal Edition

**DayBridge** is a private, installable daily organizer that brings appointments, tasks, medication records, budgeting, saved locations, and travel reminders into one interface. It is currently a **Next.js progressive web app (PWA)**, not a native Android application.

> **Release scope (2026-10-24):** `main` contains the personal security baseline, encrypted device-first synchronization and daily drug-test check-ins. The owner-approved Supabase security migration passed record-preservation checks, but live installed-device acceptance and institutional enrollment approval are separate outstanding gates. DayBridge is **not represented as HIPAA compliant**. See [personal release evidence](docs/pilot/PRODUCTION_RELEASE_2026-10-24.md) and [pilot readiness](docs/pilot/PILOT_TECHNICAL_READINESS.md).

> **Map implementation:** Locations and appointment travel use one fully interactive MapLibre 6 renderer with TomTom Orbis street tiles, selectable markers, traffic layers and road geometry. Static-map replacement has been removed. Desktop/mobile browser tests use controlled tile fixtures; production credentials, authenticated imagery and installed-device behavior require separate live verification.

## What DayBridge does

| Area | Capabilities |
| --- | --- |
| **Today** | Daily overview, upcoming commitments and quick actions. |
| **Schedule** | Calendar month/week views, recurring appointments, classes/groups, self-help meetings, daily drug-test check-in windows, and verified destination addresses. |
| **Tasks** | Private to-dos and priorities linked to the daily workflow. |
| **Budget** | Real, manually maintained accounts, income/expense transactions, bills, paycheck plans and reserves. No fabricated account balances. |
| **Medications** | Medication schedules and self-entered dose history; archive, restore or permanently delete with confirmation. |
| **Locations & Maps** | Map visible without planning a trip, saved-place markers, TomTom address/POI search, route alternatives, traffic-aware ETAs and external navigation links. |
| **Other** | Court & classes, contacts/resources, weekly review, device/setup controls and security settings. |

The mobile navigation groups the four primary sections as **Today, Schedule, Tasks, Budget**, with other features under **More**.

## Daily drug-test check-ins

The **Drug test check-in** event type supports a *personal reminder to check whether testing is required*. It does not determine whether a court or program actually called someone for testing, and it is not a test appointment or official verification.

1. Open **Schedule → Add event**, choose **Drug test check-in**, and set the start and end of the daily call/check window in the intended timezone. **Daily** recurrence is preselected; confirm it before saving.
2. The check-in appears in **Today** and on **Schedule**. During each occurrence's window, eligible appointment push reminders are generated in **15-minute slots** until the end of the window or until that day's check-in is marked done. Late server runs select the current slot instead of sending a backlog.
3. Select **Mark done** after checking the program's actual testing instructions. **Undo done** reopens that occurrence; the next day is tracked independently. Completion is a private self-report and does **not** assert that a drug test was attended or passed.

To stop **server-side** reminders, the completion must synchronize successfully; **Done on this device** means it is still awaiting cloud sync. Notifications require an active push subscription, notification permission, synced records and an operating scheduler; timing and device display are not guaranteed. Quiet hours and appointment-notification preferences apply. Keep a separate reliable way to check requirements and deadlines.

## Sign-in and installation

DayBridge is a **PWA**, installable from a supported browser on desktop or mobile; it is not a native Android app and does not have a continuously running background GPS service. First open it online at the same origin you intend to keep using, then use the browser's install/add-to-home-screen flow where supported.

- Existing accounts can sign in with their **email and password**, or with a **previously assigned username and password**. Username compatibility uses an internal non-deliverable Supabase Auth alias; it does not create independent username-native authentication.
- There is **no public sign-up** in the interface. Administrators manage approved accounts in Supabase. Provider-side signup restrictions must be verified separately; hiding registration in the UI is insufficient.
- Existing users may change their password in **Settings**. Passkey login is experimental/provider dependent. Legacy username aliases have **no self-service email recovery**; use an approved private administrative recovery process.
- Manual and optional inactivity locks are available, but unlocking them requires online password verification. Use device-level screen protection; locking the UI does not independently encrypt data.

See [username authentication and provisioning](USERNAME_AUTH.md) for existing-account preservation and the restrictions on enrolling new pilot users.

## Travel, maps and notifications

**Maps page.** Open **More → Locations & Maps**. DayBridge displays an interactive **TomTom Orbis v2 raster** street map before any route is selected. It can show approved saved places, search results and optional Traffic Flow / Road Incidents overlays. The next in-person calendar appointment supplies the destination and timing automatically. Its route, alternatives, ETA, leave-by time and navigation appear directly below the *same* map; no separate trip form is needed. Upcoming appointments can be selected from the calendar list, and selecting a saved place or search result temporarily shows that destination instead.

**Location.** DayBridge requests current location automatically after sign-in and whenever the workspace becomes visible. Browser/device permission remains required. A shared foreground watch rejects fixes older than two minutes or less accurate than 200 meters and stops when hidden or locked. Current-location mode never substitutes saved coordinates. Saved-origin forecasts are an explicit planning option; an initial map centered on a saved place does not represent a GPS fix.

**Routes.** TomTom Routing loads automatically from a permitted current location or explicitly approved starting location. It uses verified appointment coordinates or an unambiguous matching saved place, plus the appointment time, travel mode and one consistent arrival buffer. Forecast routing targets appointment start minus that buffer. The UI distinguishes arrival if leaving now from arrival at the recommended leave-by time, and includes dates, the appointment time zone, and the last check time. Missing or ambiguous destinations prompt correction in Schedule. Schedule edits and cancellations update the trip automatically, and traffic refreshes while the map is open. Routes provide distance, ETA, travel time, traffic delays and alternatives. External Google Maps / Apple Maps links are offered for navigation.

**Travel reminder timing.** The **Remind me** slider directly below **Arrive early** supports up to five hours (including 1, 2, 3, 4 and 5 hours). With fresh foreground GPS, the selected interval is before calculated leave-by, which already includes travel time and the early-arrival buffer. The same setting controls ordinary appointment reminders before appointment start while closed. For example, a noon appointment, one-hour drive, fifteen-minute buffer and one-hour reminder produces a 10:45 leave-by and 9:45 foreground travel heads-up; the closed-app appointment reminder is at 11:00 and asks the user to open DayBridge for fresh travel timing.

**Background departure checks.** A Supabase scheduled job runs once a minute. It rebuilds appointment, check-in, medication, task and billing reminders from the latest synced records. In default current-location mode, closed-app notifications ask the user to open DayBridge for fresh GPS; they never claim a current-location ETA from an old origin. While visible and online, a stateless authenticated heartbeat checks the next eligible calendar trip using a fresh fix and sends any departure alert only to that reporting device. Coordinates are not written to snapshot history or a GPS trail, and the alert expires with its fix. Explicit saved-origin forecast mode can continue server travel monitoring while closed, clearly labeled as a saved start. Compatible push registration, permission, server configuration, connectivity and OS policy still determine delivery; provider acceptance does not prove device display.

**Reminder delivery and destinations.** Appointment lead-time reminders, daily testing-window check-ins (15-minute slots), due tasks, scheduled medication doses, bill dates and explicit refill dates share the server queue. Medication snoozes are checked again after fifteen minutes. Bills/refill dates use 9 AM in the profile timezone; tasks use their saved due time. Routine alerts respect quiet hours, and each category can be disabled in Settings. Only the latest synced, incomplete records generate candidates, with a thirty-minute catch-up window rather than a backlog flood. Successful provider acceptance is recorded per device, allowing partial retries without resending to devices with saved receipts. Expired subscriptions are disabled; existing granted registrations reconnect on sign-in and network recovery. One browser endpoint can belong to only one active account.

Tapping an appointment opens its occurrence details; traffic opens its selected calendar route; task, dose, bill and refill notifications focus their exact record. Targets survive startup/sign-in, and deleted/changed records produce a notice. Cross-account targets are rejected. Settings has one real push test scoped to the current device, which links back to Settings. Provider acceptance is not proof that the OS displayed the notification.

Apply the reliable-notification-delivery migration before deploying. Deploy the updated `daybridge-travel-dispatch` Edge Function as well, retaining its existing Vault-secret authentication. The scheduler's HTTP response includes per-pipeline counters and failures for diagnostics.

**Notifications and acknowledgment.** The working server-side traffic monitor and browser Web Push are not the same as a native Android foreground location service. The proposed **On my way** notification action is tracked separately in [PR #10](https://github.com/GI-Company/Daybridge/pull/10); do **not** assume that feature is included in production until that PR is merged, deployed and verified on a real device.

A native Android location service is a future architecture stage; the current installed PWA cannot reliably track live GPS continuously after being closed.

**Custom calendar key.** In **Schedule → Customize calendar key**, users can add categories, edit their names and colors, or remove/restore entries. The same metadata drives calendar dots, the legend, event creation and Today labels. Removing an entry hides it from the key and new appointment choices; existing appointments and reminder behavior remain intact. Customizations sync in the existing private profile JSON without a schema migration.

### Map status and troubleshooting

The map supports drag, touch gestures, keyboard navigation, zoom controls, fullscreen, a scale, live foreground location and route fitting. Both map screens share the same renderer and update their markers and routes without recreating it. Search results can be saved as verified places for future appointments. Searches use the map's visible center to prioritize nearby results.

MapLibre 6 requires a separate module worker and WebGL 2. `scripts/prepare-maps.mjs` publishes the installed worker to a versioned same-origin URL during install, dev startup and build. `lib/travel/map-runtime.ts` configures that URL before constructing a map. The container uses explicit positioning so MapLibre's unlayered stylesheet cannot override Tailwind's layout and clip the map.

If imagery fails, the interactive renderer stays on screen with a diagnostic and **Retry interactive map**. It never switches to a fixed image or fabricated route. Check browser graphics support, authentication, TomTom entitlement and network connectivity. Traffic errors have their own retry control. Online reconnection reloads tiles and visible traffic refreshes every minute while the tab is active.

Street tiles, flow, incidents, address verification, place search, route calculation and push tests have independent, atomic server-side request budgets. Apply the scoped rate-limit migration before deploying this code.

The map endpoints are `/api/travel/map-tile/[z]/[x]/[y]` and `/api/travel/map-overlay/[layer]/[z]/[x]/[y]`. All TomTom keys remain server-side. See [TomTom map architecture](docs/TOMTOM_MAP_ARCHITECTURE.md) and [travel deployment notes](TRAVEL_DEPLOYMENT.md).

## Data protection and offline use

DayBridge is **device-first, cloud-synchronized**, not a purely online form:

- Each signed-in user has an **AES-256-GCM encrypted IndexedDB snapshot** on their current device. The encryption key stays non-extractable inside browser storage.
- An owner-restricted Supabase `private_snapshots` record and revision history are used for cloud synchronization. Supabase Auth and row-level security isolate user data.
- The app shell can reopen offline after a successful online load; private API data is not cached by the service worker.
- Changes are saved locally first, then synced when a valid session and connection are available. Conflicting server revisions should block overwrite rather than silently destroying the newer copy.
- **Update Now** checks for a new production version and protects unsaved work and pending synchronization. Ordinary updates do not require reinstalling.

**Important:** Clearing browser/site data, switching origin or browser profile, uninstalling the PWA, or storage eviction can erase the device copy. Confirm **Saved** and keep a controlled backup before reinstalling or making major device changes. Exported JSON is unencrypted.

Read [Offline & sync behavior](OFFLINE_SYNC.md), [Security](SECURITY.md), [Privacy](PRIVACY.md) and [Known limitations](KNOWN_LIMITATIONS.md).

## Stack

- **UI:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4 and Lucide icons.
- **Backend:** Vercel server routes; Supabase Auth, PostgreSQL, row-level security, Edge Functions, Vault and scheduled travel checks.
- **Maps:** TomTom Map Display (Orbis raster), TomTom Routing, Geocoding, Search, and optional Orbis Traffic tiles; MapLibre GL for interactive rendering.
- **PWA:** Installable on supported desktop/mobile browsers, service worker for app shell and Web Push, version-based update checking.
- **Privacy:** Browser-facing Supabase publishable credentials only. All sensitive TomTom, Supabase service-role, cron and VAPID private keys remain server-side.

## Run locally

Requires Node.js **24.x** (see `package.json`).

```bash
git clone https://github.com/GI-Company/Daybridge.git
cd Daybridge
npm ci
cp .env.example .env.local
# Fill in the Supabase public URL and publishable key
npm run typecheck
npm run lint
npm test
npm run test:db
npm run test:map
npm run security:scan
npm run build
npm run dev
```

Set at least `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. In production, configure `tom_tom` (or `TOMTOM_API_KEY`) for routing, search, traffic and map imagery, and optionally the dedicated server-only `MAPS_DISPLAY` key for Orbis imagery. Map tiles, background travel work and push notifications require their corresponding **server-side** credentials and migrations. Do not commit `.env.local` or publish private API keys as `NEXT_PUBLIC_*`.

Apply the SQL migrations in `supabase/migrations` to **your own** Supabase project with a reviewed migration history and backup. The existing connected production project already has migrations and scheduled infrastructure installed, including `20261024040536_personal_security_baseline.sql`; **do not blindly replay migrations, reset the database or reveal Vault secrets**. Owner-only sign-up policy and auth configuration must be enforced by Supabase, not just hidden in the UI.

For browser acceptance tests, install Playwright Chromium (`npx playwright install chromium`) and run `npm run test:browser:production`. The production browser harness exercises the real UI/MapLibre worker against **synthetic** transport and map fixtures; it does not verify real TomTom credentials, push delivery, installed devices or hosted authentication. `npm run test:db` uses a disposable PGlite database rather than the production database.

## Release and pilot readiness

**Personal app, `main`:** The 2026-10-24 release record reports an owner-approved, guarded Supabase security migration and successful before/after preservation checks for all 26 pre-existing public tables. The current source includes account-specific access controls, manual/optional inactivity locking, push ownership controls, hardened API requests, revision-checked cloud saves and local encryption. This evidence **does not establish** that the latest Vercel build, live third-party services or the owner's installed-device smoke test passed; those require separate verification.

**Validation boundaries:** The [local verification report](docs/pilot/evidence/TEST_RESULTS.md) records type checks, lint, unit/database/browser tests, a secret-pattern scan and an npm audit on the assessed revision. More recent commits (including the daily check-in implementation) should be retested independently. Hosted GitHub Actions was blocked by an account billing lock in that report, so a successful remote CI run must not be inferred.

**Institutional pilot: NOT approved for enrollment.** Before using DayBridge with other participants or regulated treatment records, complete documented gates for secure provisioning/recovery, real-device notification behavior, incident operations, deletion/retention, hosted backups, consent, legal classification and relevant processor contracts/BAAs. Personal use and technical hardening are not HIPAA certification. See the [pilot readiness report](docs/pilot/PILOT_TECHNICAL_READINESS.md), [HIPAA/Part 2 gap analysis](docs/pilot/HIPAA_READINESS_GAP_ANALYSIS.md) and [privacy description](PRIVACY.md).

## Before relying on DayBridge

1. Install, sign in and verify the cloud **Saved** status before using the app offline.
2. Check that a new test appointment survives an app restart, device reconnection and production update.
3. Register push permissions and subscription, approve a saved origin, and run a controlled appointment/traffic alert test with the app closed.
4. Verify the **interactive** TomTom map, route previews and optional traffic tiles on every target browser. A successful build alone does not establish that production map imagery is working.
5. Keep independent reminders for time-critical medical and court obligations until background delivery is verified on the actual device.

DayBridge is a personal organization aid, **not** official court attendance verification, a medical device, or a guaranteed emergency notification service.

## Development references

- [Offline sync](OFFLINE_SYNC.md)
- [TomTom API feature architecture](docs/TOMTOM_MAP_ARCHITECTURE.md)
- [Travel worker and map deployment](TRAVEL_DEPLOYMENT.md)
- [Security design](SECURITY.md)
- [Known limitations](KNOWN_LIMITATIONS.md)
- [Username authentication](USERNAME_AUTH.md)
- [Testing and verification evidence](docs/pilot/evidence/TEST_RESULTS.md)
- [Personal production release record](docs/pilot/PRODUCTION_RELEASE_2026-10-24.md)

## Institutional security work

The audit and technical readiness package originated on `feat/daybridge-pilot-security-hardening`; a specifically approved **personal** security baseline has since been brought into the production path. That approval does not authorize institutional onboarding, new credentials, regulated data, or additional production migrations. Review the [pilot architecture, audit, testing and rollout gates](docs/pilot/PILOT_TECHNICAL_READINESS.md) before any further expansion, preserving existing user records and release rollback options.
