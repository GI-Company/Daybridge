# DayBridge offline-first, device-encrypted saving

## Data locations and control flow

- **Supabase** is the authoritative, RLS-protected record store. Previous cloud revisions are kept in private snapshot history.
- **This device** keeps an AES-256-GCM encrypted snapshot in IndexedDB, under a separate key for each authenticated user ID. The non-extractable CryptoKey is stored in the same origin's IndexedDB key store; neither sensitive JSON nor key bytes are copied into \`localStorage\` or a service worker cache.
- **App shell only**: the service worker caches \`/\` (the public shell) and versioned \`/_next/static/\` assets so the app can reopen without an Internet connection **after first successful online loading**. It never caches private API responses.
- **Device-first commit**: every in-app record edit queues an encrypted device write. The UI must not claim the edit is safely on the device until that IndexedDB transaction completes. The next sync uses the Supabase \`save_private_snapshot\` RPC with an expected revision.
- **Reconnect**: synchronization retries on foreground, online, every 30 seconds while the app is open, and via Settings → Recovery backups & data protection → Sync now.
- **Conflict**: if Supabase has a different newer revision, the app stops automatic writes and preserves the local encrypted copy. Download a secure JSON export from Settings before reconciling. No automatic last-write-wins merge for medical, court, budget, or appointment records.
- **Updates**: Update Now remains blocked until cloud synchronization has succeeded and unfinished dialogs are closed. Installation/reinstallation is not needed for normal production updates.

## Privacy limitations

AES-GCM encrypted snapshots are encrypted at rest, **not end-to-end encrypted against a same-origin JavaScript compromise or an unlocked browser profile**: the non-extractable key is usable by DayBridge itself. This implementation does not prompt for a separate offline PIN. Device screen lock and safe browser maintenance remain important.

IndexedDB may be removed by clearing site data, changing browser profiles/origins, uninstalling the PWA, using private browsing, or storage eviction. "Protect device storage" requests persistent storage where supported, but may not be granted. Keep cloud sync and recovery history active; do not use this as the only record for time-critical court or medical obligations.

Offline login requires a **previously signed-in, unexpired Supabase browser session**. The app does not support creation of new accounts while offline. Sync requires an authenticated Supabase session and network access. Data is not uploaded in the background while the PWA is fully closed; reopen DayBridge to resume checks.

## End-to-end smoke test (manual on installed Android PWA)

1. Sign in, create a harmless test appointment, and verify Header → **Saved**.
2. Open Settings → Recovery backups & data protection → Encrypted records on this device; select **Protect device storage** and inspect the result.
3. Enable airplane mode, return to the app, edit a second harmless test record. Verify **On device** appears after the IndexedDB write.
4. Close and reopen the installed app **without logging out**, while the session remains valid. The test record should still be present. The phone must have launched the PWA successfully online at least once to warm its app shell.
5. Turn airplane mode off. Reopen/foreground the app and select **Sync now** if necessary. Header should switch to **Saved** after Supabase confirms.
6. Inspect the \`private_snapshots\` revision for that account (without reading its private payload in logs) and confirm it increased.
7. With a draft form open, request an app update. Verify the update banner refuses to reload until the form is closed.
8. Repeat after blocking the network: an unsynced local change must **not** be removed by a production update.
9. Use a second device to edit the same user's snapshot before the first device syncs; verify the first device gets a conflict warning and never overwrites the newer server record.
10. Restore connectivity, check settings history and export a prior test revision. Exports are **unencrypted JSON** and require deliberate local handling.

## Next safety improvements
- User-controlled offline encryption passphrase or hardware-assisted account unlock for stronger at-rest threat models.
- An explicit conflict resolver with human review and per-record merges instead of whole-snapshot overwrites.
- Separate high-reliability device recovery/export flow and automated integration tests using an authenticated test account.

## Deployment verification

Do not claim this version is released until the latest \`main\` Vercel production build is **Ready** and the phone smoke test passes. Vercel build logs are required if TypeScript fails; build errors cannot be inferred from a GitHub commit alone.
