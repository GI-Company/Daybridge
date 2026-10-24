# Retention, deletion and participant control

Date: 2026-10-23. This is a proposed operating policy requiring an identified privacy owner and sponsor approval. No retention purge or live deletion was executed.

## Current behavior

Active records persist in the owner snapshot. Every changed cloud payload retains an earlier revision in `private_snapshot_history`; no expiry job is present. The candidate security metadata table also has no expiry job. Device snapshots are encrypted per account but persist across sign-out; sign-out is not secure device erasure. Tokens are managed by the Auth SDK. The service worker caches only public code/shell assets.

Medication archive hides an item while retaining history. Permanent medication deletion, after confirmation, removes current medication/schedules/logs but does not erase past cloud snapshots or backups. Removing a task/event similarly removes it from the latest state, not every retained revision. No complete self-service account deletion or cloud restore UI is exposed. `clearAllUserData` is an internal state reset, **not** a verified erasure service and must not be marketed as one.

Export All Data asks for explicit confirmation and downloads unencrypted JSON of the current account's visible domain records. It excludes Auth credentials, historical snapshots, push keys and infrastructure audit records. There is no general import button; recovery must validate ownership/schema/revision. Participant-created exports cannot be remotely revoked. Test exports contain synthetic records only.

## Policy decisions required before enrollment

The sponsor/privacy owner must approve: purposes and data categories; active-record retention; history window; security-log retention; backup expiry; withdrawal handling; legal holds; who can execute deletion; and participant notice. Do not invent an indefinite retention policy, promise instant deletion from immutable backups, or assume a generic HIPAA medical-record retention period applies to all data here. Retention must fit actual legal and operating responsibilities.

For capacity budgeting only, a 30-day recovery-history window may be evaluated. It is **not implemented or approved**. Any expiry migration needs separate review, a tested backup and explicit permission. No pilot promise should refer to that window until activated and verified.

## Proposed verified deletion workflow

1. Authenticate the request privately; collect no additional court/health detail for identity verification. Explain current export and backup limits. Offer an export before withdrawal.
2. Identify exactly one Auth UUID and all related rows/keys. Verify no other participant is included. Record the authorized scope, requester, reviewer and minimal ticket metadata outside public Git.
3. Revoke sessions and disable deliveries. Account deletion alone does not immediately invalidate every issued access token; evaluate expiry/session validation and device access separately.
4. In a disposable environment first, test owner-scoped deletion across current snapshots, history, audit, travel/support tables, legacy normalized records, device copies and Auth. Preserve other synthetic accounts byte-for-byte. Review legal holds and backup expiry with the privacy owner.
5. Obtain explicit approval before a production purge. Use a transaction and reviewed scoped procedure, not a broad table reset or dashboard-wide deletion. Retain minimal deletion evidence without copying the deleted content.
6. Explain which encrypted backups remain until scheduled expiry and how restored backups will reapply an approved deletion register. On every participant device, clear the correct origin/profile only after saved/exported data is verified. This step can destroy unsynced work and needs the participant's informed choice.

These steps are an unexecuted runbook. End-to-end erasure, token revocation and backup re-deletion remain release gates; the current test suite must not be described as proving them.

## Participant-first pilot notice

Explain voluntary use, who operates hosting, vendor access, what courts cannot see through the app, reminder uncertainty, device-loss risk, export handling and contact/withdrawal routes. No automatic court sharing or sanction scoring exists. Infrastructure administration still permits sensitive access; organizational separation, logging and least privilege are necessary. Future sharing must be separately authorized and reviewed.
