# DayBridge Travel Rollout — Infrastructure and Security

## Current status
- The Route Planner and Travel Preferences screens are integrated with Supabase and TomTom routing and require a signed-in user.
- TomTom's production \`tom_tom\` is consumed server-side only.
- Supabase Edge Function \`daybridge-travel-dispatch\` is deployed in a **fail-closed** state.
- **Scheduled alerts will NOT run until the missing Vercel secrets, Supabase Vault secret, and pg_cron job are explicitly configured.**
- A key with access to Map Display must be **separately restricted to the production origin** before setting \`NEXT_PUBLIC_TOMTOM_MAP_KEY\`. Never copy the server routing key to a public variable.
- App currently defaults to current origin, navigation true, notifications true, 15-minute buffer, private lock screen. **User must explicitly approve a saved origin and enable monitoring on each appointment** to receive background route checks.


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
