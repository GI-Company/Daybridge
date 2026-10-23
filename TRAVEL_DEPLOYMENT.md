# Notification reliability update — October 22, 2026

The reliable-notification-delivery migration changes the existing Supabase schedule to once per minute and sets a 60-second HTTP timeout. Deploy the updated `daybridge-travel-dispatch` function with its existing Vault-secret authentication; it allows up to 55 seconds and returns the worker's per-pipeline counts/failures. No Vercel Cron or preview deployment is needed.

The server reconciles the next 36 hours of verified calendar travel plans from the current private snapshot. It respects cancellations, occurrence edits, saved-origin changes, per-event mode/buffer and explicitly disabled plans. Traffic polling is once a minute near departure, every five minutes within four hours, and every thirty minutes for later appointments. Other reminder categories run each minute independently of routing failures.

Notification taps open the exact appointment details, calendar route, task, medication slot, bill or refill record. Startup/sign-in retains the destination. Device acceptance receipts allow partial retries, and a browser endpoint belongs to one active account. Settings contains category controls and one remote delivery test scoped to the current device. Provider acceptance does not prove an OS-visible notification; verify arrival and tap behavior in the installed app.

The earlier rollout notes below describe the initial travel implementation. Timing and notification behavior above supersede them.

---

# DayBridge Travel Rollout — Infrastructure and Security

## Current status
- The Route Planner and Travel Preferences screens are integrated with Supabase and TomTom routing and require a signed-in user.
- TomTom's production \`tom_tom\` is consumed server-side only.
- Supabase Edge Function \`daybridge-travel-dispatch\` is deployed in a **fail-closed** state.
- **Background worker active as of October 22, 2026:** a five-minute Supabase `pg_cron` job invokes `daybridge-travel-dispatch` using a secret referenced from Vault. An authenticated manual dispatch returned HTTP 200 from the Vercel worker. Push delivery remains best effort and requires an eligible appointment, approved saved origin, verified appointment destination, and active push subscription.
- Map Display and traffic keys stay server-side; no public TomTom key is needed.
- App currently defaults to current origin, navigation true, notifications true, 15-minute buffer, private lock screen. **User must explicitly approve a saved origin and enable traffic notifications**. Eligible appointments with a verified destination enroll automatically; each appointment can still have monitoring disabled.


## Guided Add and automatic traffic updates (October 22, 2026)
- Global Add opens a category chooser; classes/groups and self-help meetings are distinct private categories. No GPS attendance verification or staff dashboard is included.
- For an in-person event with a verified destination (selected saved place or address verified in the Add form), DayBridge enrolls its future occurrence(s) into private server-side travel monitoring only when traffic notifications are enabled and the user has separately approved saved-origin coordinates. Weekly events are enrolled up to a rolling one-year horizon when the app synchronizes; a deliberately disabled travel plan is not re-enabled.
- The scheduler checks traffic every five minutes and sends a deduplicated `preparation` notification on the first check within 60 minutes of appointment start. Leave-by warnings can also fire when they are due, including before the final hour for longer trips.
- Private lock-screen mode hides route specifics in push previews. Disabling private mode allows ETA, estimated delay, and leave-by wording. The service worker now displays the server-provided notification rather than always substituting a generic message.
- Missing browser notification permission, a device being offline, an unverified address, or an origin without explicit consent prevents a guaranteed delivery. The app never obtains closed-app live GPS.
- The background HTTP trigger was tested, but an end-to-end real push to an eligible appointment/device has not yet been verified.

## Map Display credentials and mobile route preview
Both map screens use `ExploreMap`, with `RouteMap` supplying appointment route data. TomTom Orbis v2 street and traffic PNG tiles are fetched through authenticated same-origin proxies. Use server-only `MAPS_DISPLAY` for a dedicated street-imagery key, or the existing `tom_tom` / `TOMTOM_API_KEY` credential with Map Display entitlement. Routing, search and traffic use the latter credential. There is no static-map endpoint or static rendering mode.

`npm ci`, `npm run dev` and `npm run build` prepare the exact installed MapLibre worker under `public/maps/maplibre/<version>/`. The versioned URL is configured before either map mounts and can be cached safely by the PWA. Preserve this directory when packaging a standalone server; copy `public/` and `.next/static/` alongside the standalone output as with other Next.js public assets.

Apply `20261023012558_scoped_travel_rate_limits.sql` **before** deploying this code. It adds service-role-only request budgets and `take_scoped_travel_api_slot`, with separate counters for street tiles, traffic flow, incidents, places, geocoding, routes and push tests. The old limiter remains intact for older deployed app versions. The new code fails closed if the migration is missing.

## Production Vercel variables
Already present per project inspection: \`tom_tom\`, Supabase public URL/publishable keys, and service-role credentials. Existing values must remain unchanged.

Create these NEW variables in the \`daybridge\` production project after Vercel team authorization:
- \`NEXT_PUBLIC_VAPID_PUBLIC_KEY\` — P-256 public VAPID key (base64url)
- \`VAPID_PRIVATE_KEY\` — corresponding private VAPID key (sensitive, server-only)
- \`VAPID_SUBJECT\` — \`mailto:<your-controlled-email>\` or \`https://daybridge-swart.vercel.app\`
- \`DAYBRIDGE_CRON_SECRET\` — long randomly generated string, kept as **sensitive**

Generate VAPID keys locally with \`npx web-push generate-vapid-keys\`, and a cron secret using a cryptographically secure local generator. **Never commit these values or paste them in public chats.** The same cron secret is used only in Vercel \`DAYBRIDGE_CRON_SECRET\` and the private Supabase Vault secret \`daybridge_worker_secret\`.

## Only after those production variables are active
1. Redeploy a build that **passes TypeScript and production validation**.
2. Store the same cron secret in Supabase Vault under the name \`daybridge_worker_secret\`; never store plaintext in SQL source or migrations.
3. Supabase Cron: create a \`pg_cron\` schedule every 5 minutes that calls \`net.http_post\` to \`https://gzdlcetowanmnqzlqqca.supabase.co/functions/v1/daybridge-travel-dispatch\`. Supply the secret via the \`x-daybridge-cron-secret\` header selected from \`vault.decrypted_secrets\`. Enable \`pg_net\` if not installed. The Edge Function validates against Vault with service-role-only access and then invokes the Vercel route using the same secret.
4. Test one valid and one invalid cron token, with no personal data in logs; verify rejected call returns 401.
5. Install the PWA, sign in, tap **Enable notifications**, then **Send real push test**, with the app in foreground and closed.
6. Approve a saved origin for the monitoring job. **Do not auto-save or auto-update GPS**.
7. Create a real in-person appointment using a complete address; verify coordinates, route alternatives, traffic, leave-by, monitoring opt-in, rescheduling, cancellation, expired subscription behavior.
8. Verify Supabase RLS via accounts with different JWTs, and test rate limits; check Supabase security advisor.
9. Confirm Android and iOS installed PWA notification behavior. Critical appointments must retain an independent reminder method.

## Minimal pg_cron job recipe (run manually, not automatically)
\`\`\`sql
-- DO NOT insert the raw secret into a migration or SQL editor history.
-- Create the Vault secret from a secure admin-only environment.
-- Requires enabled pg_cron and pg_net.
select cron.schedule(
 'daybridge-travel-every-five-min',
 '*/5 * * * *',
 $$
 select net.http_post(
  url := 'https://gzdlcetowanmnqzlqqca.supabase.co/functions/v1/daybridge-travel-dispatch',
  headers := jsonb_build_object(
   'Content-Type','application/json',
   'x-daybridge-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name='daybridge_worker_secret' limit 1)
  ),
  body := '{}'::jsonb
 );
 $$
);
\`\`\`
Do not activate until you have set Vercel secrets, inserted Vault secret, confirmed the destination and tested the handler.

## Important limitations
- A PWA cannot reliably read GPS while closed or terminated.
- Web Push is best effort. Platform Do Not Disturb, offline devices, OS restrictions and user settings can prevent timely delivery.
- Foreground guidance uses map route/maneuvers and live GPS, **not** a validated spoken turn-by-turn native navigation replacement. Use Google/Apple Maps handoff for driving directions.
- Routing to a far-future appointment uses modelled/historical estimates, not guaranteed live traffic.
- Multiple edits and stale client state are not yet transactionally reconciled across devices.
- Supabase stores coordinates and appointment metadata to run private monitoring; not end-to-end encrypted.

## Traffic ETA changes, late risk, and faster alternatives
- Server monitoring continues every five minutes for eligible scheduled appointments with verified coordinates, push permission, traffic notifications enabled, and a separately approved saved origin. Both total trip time and traffic delay are compared to the last successful check; shifts of five minutes or more can trigger a deduplicated travel update.
- During the final two hours the worker requests up to two alternatives alongside the fastest TomTom route. The recommended route is the quickest of the returned candidates. If departing from the saved origin now risks arriving after appointment start, the worker prioritizes a possible-lateness notice; it does not claim to know the user's live location.
- For far-future appointments TomTom supplies forecast/historical estimates; close to departure the route is calculated using current traffic. Estimates and arrival times are not guarantees, and a faster route is not always available.
- Traffic push notifications link to the appointment's local calendar date. Sensitive route and appointment details stay off the lock screen when private notification wording is enabled.
- Opening the appointment's travel section automatically loads route choices when a saved starting location was approved. Only explicitly started foreground guidance uses current phone GPS. While foreground guidance remains open, it refreshes live routes as the user moves, keeping the fastest displayed option selected. This is not a full turn-by-turn navigation engine; an external navigation app remains recommended while driving.
- Permanent/background GPS tracking, automatic changes to an external navigation application's active route, and guaranteed real-time delivery while the phone is offline are not supported.



## Interactive map validation

`npm test` runs the domain and geometry regressions. `npm run test:browser` starts an isolated Next.js harness, tests the real MapLibre worker in desktop and mobile Chromium, and removes the harness afterward. HTTP tile fixtures are controlled test data, not a production map provider or fallback.

Run `npx playwright install chromium` once before browser tests. Check successful worker delivery, clickable markers, pan/zoom, route changes without recreation, traffic retry and interactive recovery after a tile outage. The test harness is generated only by the test runner and is excluded from source control; finish browser tests before building a release.

Production acceptance additionally requires a signed-in PNG response from each tile layer, a real route from the selected origin/destination, and verification in the installed PWA. Vercel team-scope authorization is needed to inspect production credentials and deployment logs. Do not report local fixture tests as live TomTom validation.
