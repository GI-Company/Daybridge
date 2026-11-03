# Court administrator portal

The `/admin` dashboard uses the existing, normalized court registry and Supabase password sign-in. A selected court is never an authorization grant: every protected API request verifies the signed-in identity, an active staff membership, the selected court, and the identity's court-specific alias.

The dashboard follows the supplied admin portal mockup with responsive navigation, court context, licensed/assigned/available seats, participant creation, searchable accounts, credential resets, activity, and settings. Counts and subscription status come from the database. Test courts are labeled; no mock participants or manufactured activity ship in production.

## Working flows

- **Create Account:** enter a globally unique 3–32 character participant username. The internal Auth alias is previewed using the same helper as participant sign-in. The existing server creates the Auth identity, atomically assigns a court seat, and records the creation. A server-generated temporary password is shown once; no staff-selected or default password is introduced.
- **Credential handoff:** reveal or copy credentials explicitly. The card clears on dismissal, court/account change, sign-out, relevant navigation, and after five minutes. Secrets remain in component memory and never enter local storage, URL parameters, audit responses, or application logs. The participant's first sign-in still requires a password change.
- **Participants:** search by username and filter assigned, active, suspended, removed, or all accounts. Suspension retains a seat; removing an assignment frees it and retains records; restoration checks capacity. Every account action requires an explicit confirmation dialog. Created-by labels distinguish the current administrator from other court staff without exposing unrelated identities.
- **Activity:** authenticated, court-scoped audit events with validated timestamp/UUID cursor pagination. Participant names are resolved only inside the same court. Refresh and older-event controls read persisted events; passwords and participant-owned private content are excluded.
- **Settings:** authoritative court/subscription details, court selection, password change with current-password verification, and sign-out. Licensing and staff grants remain owner-managed.

Delayed requests are ignored after a court or account change, including account provisioning responses containing temporary credentials. Errors do not display a success card or manufacture database state.

## Verification and limits

Run `npm test`, `npm run test:db`, `npm run typecheck`, `npm run lint`, `npm run security:scan`, and `npm run test:browser:production -- admin-portal.spec.ts`. The browser harness uses fictional accounts and simulated HTTP responses; it verifies UI behavior, not production Auth delivery. Database tests run the actual migrations against disposable PostgreSQL with different roles and courts. Hosted checks must additionally use a genuine court administrator session; never replace hosted authorization with the harness.

This release needs no database migration and does not change existing participant creation, reset, suspension, removal, or first-use password semantics. Existing JWT expiry and offline-cache limitations still apply; removal is not an instant remote wipe. The portal remains access administration and cannot read participant schedules, medication records, notes, finances, or attendance. It is not a compliance certification or a court case-management system.
