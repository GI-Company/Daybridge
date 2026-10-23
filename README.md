# DayBridge Personal Edition

**DayBridge** is a private, installable daily organizer that brings appointments, tasks, medication records, budgeting, saved locations, and travel reminders into one interface. It is currently a **Next.js progressive web app (PWA)**, not a native Android application.

> **Map implementation:** Locations and appointment travel use one fully interactive MapLibre 6 renderer with TomTom Orbis street tiles, selectable markers, traffic layers and road geometry. Static-map replacement has been removed. Desktop/mobile browser tests use controlled tile fixtures; production credentials, authenticated imagery and installed-device behavior require separate live verification.

## What DayBridge does

| Area | Capabilities |
| --- | --- |
| **Today** | Daily overview, upcoming commitments and quick actions. |
| **Schedule** | Calendar month/week views, recurring appointments, classes/groups and self-help meetings, verified destination addresses. |
| **Tasks** | Private to-dos and priorities linked to the daily workflow. |
| **Budget** | Real, manually maintained accounts, income/expense transactions, bills, paycheck plans and reserves. No fabricated account balances. |
| **Medications** | Medication schedules and self-entered dose history; archive, restore or permanently delete with confirmation. |
| **Locations & Maps** | Map visible without planning a trip, saved-place markers, TomTom address/POI search, route alternatives, traffic-aware ETAs and external navigation links. |
| **Other** | Court & classes, contacts/resources, weekly review, device/setup controls and security settings. |

The mobile navigation groups the four primary sections as **Today, Schedule, Tasks, Budget**, with other features under **More**.

## Travel, maps and notifications

**Maps page.** Open **More → Locations & Maps**. DayBridge displays an interactive **TomTom Orbis v2 raster** street map before any route is selected. It can show approved saved places, search results and optional Traffic Flow / Road Incidents overlays. The next in-person calendar appointment supplies the destination and timing automatically. Its route, alternatives, ETA, leave-by time and navigation appear directly below the *same* map; no separate trip form is needed. Upcoming appointments can be selected from the calendar list, and selecting a saved place or search result temporarily shows that destination instead.

**Location.** With existing browser location permission, DayBridge may center the open map on the device; otherwise choose **Use my location** to request permission. Without GPS, the initial view is labeled as an approved origin, saved location or country overview. A saved location is **not** represented as a live GPS fix.

**Routes.** TomTom Routing loads automatically from a permitted current location or explicitly approved starting location. It uses verified appointment coordinates or an unambiguous matching saved place, plus the appointment time, travel mode and arrival buffer. Missing or ambiguous destinations prompt correction in Schedule. Schedule edits and cancellations update the trip automatically, and traffic refreshes while the map is open. Routes provide distance, ETA, travel time, traffic delays and alternatives. External Google Maps / Apple Maps links are offered for navigation.

**Background departure checks.** A Supabase scheduled job runs once a minute. It rebuilds reminder candidates and eligible travel plans from the latest synced calendar, including cancellations and occurrence edits. Traffic calculations run every minute near departure, every five minutes within four hours, and every thirty minutes for later appointments. Closed-app forecasts currently use the user's **explicitly approved saved origin**, not live GPS. Delivery additionally depends on the event having a verified destination, compatible push subscription, user permission, configured server credentials, network availability and OS/browser policy. The schedule does **not** guarantee exact-second or device-visible delivery.

**Reminder delivery and destinations.** Appointment lead-time reminders, due tasks, scheduled medication doses, bill dates and explicit refill dates share the server queue. Medication snoozes are checked again after fifteen minutes. Bills/refill dates use 9 AM in the profile timezone; tasks use their saved due time. Routine alerts respect quiet hours, and each category can be disabled in Settings. Only the latest synced, incomplete records generate candidates, with a thirty-minute catch-up window rather than a backlog flood. Successful provider acceptance is recorded per device, allowing partial retries without resending to devices with saved receipts. Expired subscriptions are disabled; existing granted registrations reconnect on sign-in and network recovery. One browser endpoint can belong to only one active account.

Tapping an appointment opens its occurrence details; traffic opens its selected calendar route; task, dose, bill and refill notifications focus their exact record. Targets survive startup/sign-in, and deleted/changed records produce a notice. Cross-account targets are rejected. Settings has one real push test scoped to the current device, which links back to Settings. Provider acceptance is not proof that the OS displayed the notification.

Apply the reliable-notification-delivery migration before deploying. Deploy the updated `daybridge-travel-dispatch` Edge Function as well, retaining its existing Vault-secret authentication. The scheduler's HTTP response includes per-pipeline counters and failures for diagnostics.

**Notifications and acknowledgment.** The working server-side traffic monitor and browser Web Push are not the same as a native Android foreground location service. The proposed **On my way** notification action is tracked separately in [PR #10](https://github.com/GI-Company/Daybridge/pull/10); do **not** assume that feature is included in production until that PR is merged, deployed and verified on a real device.

A native Android location service is a future architecture stage; the current installed PWA cannot reliably track live GPS continuously after being closed.

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
npm run test:map
npm run build
npm run dev
```

Set at least `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. In production, configure `tom_tom` (or `TOMTOM_API_KEY`) for routing, search, traffic and map imagery, and optionally the dedicated server-only `MAPS_DISPLAY` key for Orbis imagery. Map tiles, background travel work and push notifications require their corresponding **server-side** credentials and migrations. Do not commit `.env.local` or publish private API keys as `NEXT_PUBLIC_*`.

Apply the SQL migrations in `supabase/migrations` to **your own** Supabase project. For the connected project, many migrations and scheduled travel infrastructure are already installed; do not blindly reapply operations or disclose Vault secrets. Owner-only sign-up policy and auth configuration must be enforced by Supabase, not just hidden in the UI.

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
