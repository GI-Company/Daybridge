# Verified limitations / next release checklist

1. **Cloud syncing:** v1 stores one JSON snapshot per owner. It is simple for one device, but later edits can overwrite earlier edits if two devices are open. Writes are debounced, and errors should be retried after reconnecting.
2. **Offline:** the service worker is deliberately push-only to avoid persistent unencrypted caches. Saved records require network. Implement encrypted IndexedDB with explicit opt-in before calling this offline-first.
3. **Reminders:** browser permission and subscription are supported, but no signed cron/Edge Function scheduler or VAPID push delivery worker exists. Manual test notifications are not reliable scheduled notifications. Keep device-calendar or native reminders for time-critical duties.
4. **Biometrics:** uses WebAuthn/passkeys with phone biometrics/PIN, not access to face scans or fingerprints. Supabase passkeys are experimental and must be configured for a stable production origin.
5. **PWA install:** browsers cannot silently install the app. iOS needs manual Add to Home Screen; browsers lacking install support stay on setup screen.
6. **Data history:** existing demo localStorage records are not silently imported. New user starts with empty data. Export old data before switching if necessary.
7. **Backend domain tables:** ready but not yet populated by this UI. Migrate from JSON snapshots with tested idempotent conversions, UUID keys, and multi-entity ownership checks.
8. **Security:** RLS security advisories cleared after schema creation; permissions, device flows, and actual tenant isolation still need integration and pen tests before personal health data.
9. **Accessibility:** responsive layout and focus visibility are implemented, but VoiceOver/TalkBack, zoom, WCAG AA color contrast, keyboard focus trapping for dialog, and reduced-motion tests need device validation.
10. **App purpose:** attendance is self-reported, not court-certified, and medication tracking is not a medical advice tool.
