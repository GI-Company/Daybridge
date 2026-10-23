# DayBridge Personal Edition

**DayBridge** is a private, installable daily organizer that brings appointments, tasks, medication records, budgeting, saved locations, and travel reminders into one interface. It is currently a **Next.js progressive web app (PWA)**, not a native Android application.

> **Release status — October 22, 2026:** The always-visible **Locations & Maps** page is deployed, and the classic TomTom static map works in at least one installed desktop PWA. The interactive MapLibre/Orbis renderer is **not yet confirmed reliable**: a screenshot from macOS shows the street map with an **“Interactive map unavailable”** fallback banner. Treat interactive pan/zoom, map markers, and optional traffic layers as pending device verification. A successful Vercel build is not a successful map-rendering test.

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

**Maps page.** Open **More → Locations & Maps**. DayBridge attempts an interactive **TomTom Orbis v2 raster** street map before any route is selected. It can show approved saved places, search results and optional Traffic Flow / Road Incidents overlays. Selecting a destination adds a route and ETA to the *same* map.

**Location.** With existing browser location permission, DayBridge may center the open map on the device; otherwise choose **Use my location** to request permission. Without GPS, it falls back to a clearly labeled approved origin, saved location or broad map view. A saved location is **not** represented as a live GPS fix.

**Routes.** TomTom Routing provides distance, ETA, travel time, traffic delays and alternatives from the chosen origin while the app is open. External Google Maps / Apple Maps links are offered for navigation.

**Background departure checks.** A Supabase scheduled job runs the travel worker every five minutes for eligible monitored appointments. Closed-app forecasts currently use the user's **explicitly approved saved origin**, not live GPS. Delivery additionally depends on the event having a verified destination, compatible push subscription, user permission, configured server credentials, network availability and OS/browser policy. Five-minute scheduling does **not** guarantee exact-minute or device-visible delivery.

**Notifications and acknowledgment.** The working server-side traffic monitor and browser Web Push are not the same as a native Android foreground location service. The proposed **On my way** notification action is tracked separately in [PR #10](https://github.com/GI-Company/Daybridge/pull/10); do **not** assume that feature is included in production until that PR is merged, deployed and verified on a real device.

A native Android location service is a future architecture stage; the current installed PWA cannot reliably track live GPS continuously after being closed.

### Map status and troubleshooting

The map deliberately provides a classic TomTom static image if the interactive viewer fails. Seeing Cleveland roads plus an **“Interactive map unavailable”** message means **the fallback image works but the interactive renderer does not**.

1. Ensure you are running the latest installed DayBridge version; reopen the PWA and use **Update Now** when it offers an update and your records are synced.
2. Try **Retry map**. A static image is not a pan/zoom-capable interactive map, and optional traffic overlays may not appear while fallback mode is active.
3. Confirm the device/browser supports WebGL and has an active connection. Do not assume a rendering failure is necessarily a bad TomTom key.
4. Developers: inspect the browser console and the authenticated map-tile response status, **without copying key values, URLs containing secrets, location history or personal appointment information** into issues.
5. The server-only Map Display keys, Orbis v2 tile entitlement, raster response type and tile rate limits must all be verified. Failed tile responses or an unsupported browser renderer should give a visible diagnostic instead of a blank map.

The relevant server endpoints are `/api/travel/map-tile/[z]/[x]/[y]`, `/api/travel/map-overlay/[layer]/[z]/[x]/[y]` and `/api/travel/static-map`. See [TomTom map architecture](docs/TOMTOM_MAP_ARCHITECTURE.md) and [travel deployment notes](TRAVEL_DEPLOYMENT.md).

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
- **Maps:** TomTom Map Display (Orbis raster and classic static image), TomTom Routing, Geocoding, Search, and optional Orbis Traffic tiles; MapLibre GL for interactive rendering.
- **PWA:** Installable on supported desktop/mobile browsers, service worker for app shell and Web Push, version-based update checking.
- **Privacy:** Browser-facing Supabase publishable credentials only. All sensitive TomTom, Supabase service-role, cron and VAPID private keys remain server-side.

## Run locally

Requires Node.js **24.x** (see `package.json`).

```bash
git clone https://github.com/GI-Company/Daybridge.git
cd Daybridge
npm install
cp .env.example .env.local
# Fill in the Supabase public URL and publishable key
npm run typecheck
npm run test:map
npm run build
npm run dev
```

Set at least `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. In production, configure `tom_tom` (or `TOMTOM_API_KEY`) for routing and classic map imagery, and optionally the dedicated server-only `MAPS_DISPLAY` key for Orbis imagery. Map tiles, background travel work and push notifications require their corresponding **server-side** credentials and migrations. Do not commit `.env.local` or publish private API keys as `NEXT_PUBLIC_*`.

Apply the SQL migrations in `supabase/migrations` to **your own** Supabase project. For the connected project, many migrations and scheduled travel infrastructure are already installed; do not blindly reapply operations or disclose Vault secrets. Owner-only sign-up policy and auth configuration must be enforced by Supabase, not just hidden in the UI.

## Before relying on DayBridge

1. Install, sign in and verify the cloud **Saved** status before using the app offline.
2. Check that a new test appointment survives an app restart, device reconnection and production update.
3. Register push permissions and subscription, approve a saved origin, and run a controlled appointment/traffic alert test with the app closed.
4. Verify the **interactive** TomTom map, route previews and optional traffic tiles on every target browser. If only the static fallback appears, interactive mapping is not yet passing.
5. Keep independent reminders for time-critical medical and court obligations until background delivery is verified on the actual device.

DayBridge is a personal organization aid, **not** official court attendance verification, a medical device, or a guaranteed emergency notification service.

## Development references

- [Offline sync](OFFLINE_SYNC.md)
- [TomTom API feature architecture](docs/TOMTOM_MAP_ARCHITECTURE.md)
- [Travel worker and map deployment](TRAVEL_DEPLOYMENT.md)
- [Security design](SECURITY.md)
- [Known limitations](KNOWN_LIMITATIONS.md)
