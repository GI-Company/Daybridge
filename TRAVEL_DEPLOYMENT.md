# DayBridge Travel Rollout — Infrastructure and Security

## Current status
- The Route Planner and Travel Preferences screens are integrated with Supabase and TomTom routing and require a signed-in user.
- TomTom's production \`tom_tom\` is consumed server-side only.
- Supabase Edge Function \`daybridge-travel-dispatch\` is deployed in a **fail-closed** state.
- **Background worker active as of October 22, 2026:** a five-minute Supabase `pg_cron` job invokes `daybridge-travel-dispatch` using a secret referenced from Vault. An authenticated manual dispatch returned HTTP 200 from the Vercel worker. Push delivery remains best effort and requires an eligible appointment, approved saved origin, verified saved destination, and active push subscription.
- A key with access to Map Display must be **separately restricted to the production origin** before setting \`NEXT_PUBLIC_TOMTOM_MAP_KEY\`. Never copy the server routing key to a public variable.
- App currently defaults to current origin, navigation true, notifications true, 15-minute buffer, private lock screen. **User must explicitly approve a saved origin and enable monitoring on each appointment** to receive background route checks.


## Guided Add and automatic traffic updates (October 22, 2026)
- Global Add opens a category chooser; classes/groups and self-help meetings are distinct private categories. No GPS attendance verification or staff dashboard is included.
- For an in-person event matching a verified saved place, DayBridge enrolls its future occurrence(s) into private server-side travel monitoring only when traffic notifications are enabled and the user has separately approved saved-origin coordinates. Weekly events are enrolled up to a rolling one-year horizon when the app synchronizes; a deliberately disabled travel plan is not re-enabled.
- The scheduler checks traffic every five minutes and sends a deduplicated `preparation` notification on the first check within 60 minutes of appointment start. Leave-by warnings can also fire when they are due, including before the final hour for longer trips.
- Private lock-screen mode hides route specifics in push previews. Disabling private mode allows ETA, estimated delay, and leave-by wording. The service worker now displays the server-provided notification rather than always substituting a generic message.
- Missing browser notification permission, a device being offline, an unverified address, or an origin without explicit consent prevents a guaranteed delivery. The app never obtains closed-app live GPS.
- The background HTTP trigger was tested, but an end-to-end real push to an eligible appointment/device has not yet been verified.

## Map Display credentials and mobile route preview
The authenticated `app/api/travel/static-map/route.ts` now uses the existing server-only
`tom_tom` key (or `TOMTOM_API_KEY` fallback) for TomTom Map Display Static Image
requests. The account's `tom_tom` key has Map Display permission. The separate
`MAPS_DISPLAY` variable is not used by the static map endpoint, avoiding an
accidental preference for a different key. Do not expose either key with a
`NEXT_PUBLIC_` prefix.

TomTom's documented classic Map Display API supports `/map/1/staticimage`.
The client fetches that authenticated same-origin image, shows its HTTP failure
reason without revealing credentials, and can retry after a failure. Route geometry
and start/end markers stay visible when the base map is unavailable.

`NEXT_PUBLIC_TOMTOM_MAP_KEY` remains an optional, independently
browser-restricted key for an interactive SDK renderer; it is not needed for the
static route preview. The static map remains a fixed image rather than
interactive zoom/pan. Do not reuse the `tom_tom` server key as a browser key.

## Production Vercel variables
Already present per project inspection: \`tom_tom\`, Supabase public URL/publishable keys, and service-role credentials. Existing values must remain unchanged.

Create these NEW variables in the \`daybridge\` production project after Vercel team authorization:
- \`NEXT_PUBLIC_VAPID_PUBLIC_KEY\` — P-256 public VAPID key (base64url)
- \`VAPID_PRIVATE_KEY\` — corresponding private VAPID key (sensitive, server-only)
- \`VAPID_SUBJECT\` — \`mailto:<your-controlled-email>\` or \`https://daybridge-swart.vercel.app\`
- \`DAYBRIDGE_CRON_SECRET\` — long randomly generated string, kept as **sensitive**
- \`NEXT_PUBLIC_TOMTOM_MAP_KEY\` — optional, *separately restricted* browser key; never the \`tom_tom\` server secret.

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

