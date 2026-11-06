# Voluntary court progress reporting

This feature is an additional capability for a later demonstration. Keep it disabled for the initial 25-participant pilot. The current production application and live database have not been changed by this implementation.

## What the implementation adds

The Court Admin portal has Participant Progress with court-wide and individual views, participant/category/UTC date filters, last reported activity, and weekly/monthly summaries. Counts describe selected, voluntarily shared entries, not all obligations or official compliance. Missing information never means a violation.

Settings & security has Sharing with My Court. All category consent starts off. A participant must enable a category **and** explicitly select an eligible private item. Enabling a category alone publishes nothing. Court staff and owners cannot set participant consent through these APIs.

The owner court-management screen can configure reporting availability, but cannot see participant progress. No flag is seeded or enabled. Missing flag rows mean disabled. The initial pilot should leave availability disabled even after any future approved deployment.

## Privacy boundaries and eligible items

The reporting categories are meeting, class, check-in and obligation. Only appointments whose built-in private category is Court, Case management or Class are eligible. A participant explicitly confirms that a selected item belongs to their court program. Classes can report only as classes; Court and Case management appointments can report as meetings, generic court check-ins or obligations. Marking the selected appointment attended in Court & Classes reports self-reported completion. A generic court check-in is a participant-chosen classification of a Court appointment, not a drug-test result.

A task is eligible only if linked to a Court or Case management appointment and explicitly selected as an obligation. Add > Task now offers an optional private court-appointment link; this link alone does not enable sharing. General tasks are excluded.

Therapy, self-help, drug-testing appointments/check-in windows, medications and medication adherence are excluded in this initial version. These exclusions are enforced in the database as well as in the interface. Health-related activity needs a separate review before extending the allowlist.

Staff responses contain only participant ID, username, account status, approved category, sanitized self-reported status, scheduled/end/report/update times, provenance and aggregates. They contain no organizer source identifiers, titles, descriptions, attendance notes, medication information, money, private notes, contacts, credentials, GPS, routes or other organizer payload. There is no staff export endpoint.

## Database architecture

Migration: `supabase/migrations/20261106184537_consented_court_progress.sql`. This is additive: existing accounts, private records, seat logic and personal-table RLS policies are preserved. It seeds no consent and performs no backfill.

| Table | Purpose |
| --- | --- |
| daybridge_reporting_courts | Court-level availability, absent/false by default |
| daybridge_reporting_consent | Participant/category consent and revision boundaries |
| daybridge_reporting_consent_history | Sanitized enable/withdrawal records |
| daybridge_reporting_items | Participant-only source selections, share start, explicit history choice |
| daybridge_progress_events | Current sanitized state, including participant-visible withdrawals |
| daybridge_report_access_audit | Staff actor, court, optional subject, UTC filter period/category and access time |

All six tables enable RLS and revoke browser-role privileges. This follows the existing closed administrative registry design. Browser roles, including authenticated staff and owners, cannot directly read or write these tables or call reporting RPCs. Only the server-held service role can execute the public invoker RPCs. Each RPC independently checks the current actor and court assignment in PostgreSQL; HTTP handlers derive the actor from verified Supabase Auth, never from client JSON. Existing alias checks, forced password change and staff reset-session checks remain in effect. Current participant onboarding metadata is checked too.

The three service-only RPCs are participant_reporting, staff_progress and owner_reporting (all with a daybridge_ prefix). Participant operations cannot target another identity or court. Staff reporting rejects owners even if they accidentally also have a staff assignment. Staff reads require active membership, matching court alias, completed password setup, a current post-reset session when required, an enabled court and an enabled feature flag. Staff can never write participant consent. Owner availability configuration returns only a boolean.

Narrow helpers and triggers live in the unexposed daybridge_private schema with fixed search paths and explicit EXECUTE revocations. The projection helper reads only allowlisted fields from the participant's existing private snapshot. A trigger reconciles current reports atomically with each private snapshot save, so edits, attendance corrections, task completion reversals, deletion, undo, redo and other-device saves cannot leave an earlier completion in the current report. No staff-facing query reads personal organizer tables. If reconciliation fails, the private save transaction fails rather than falsely acknowledging a corrected report; the existing device save/retry state remains the recovery path.

Item selection is bound to an opaque hash of its schedule/link fields. A schedule, recurrence, timezone or court-link edit withdraws reports while it differs from the approved selection. A participant can review and select the edited item again; undo restoring the exact originally selected schedule also restores its eligibility under the existing consent. Private text changes are excluded from that hash. Duplicate saved occurrences for the same source/time are not expected by the existing organizer. New reporting intentionally does not generate a recurring calendar server-side; only recorded recurring occurrences are projected. An unrecorded occurrence is unknown and must not be counted as missed.

## Consent and history lifecycle

Normal item selection shares activity from the server's selection time forward. Earlier scheduled dates and earlier completion timestamps are excluded. To include history, the participant must separately check Include historical activity, select a UTC start date within the past year and confirm the choice for that specific item. The explicit selection and provenance are recorded. Enabling consent never automatically republishes an older selection.

Disabling a category or stopping an item withdraws its current reports from staff and stops future sharing. The participant can review the latest 500 shared item states, including withdrawn entries, and latest 100 consent changes. This is a current-state history, not an immutable log of every completion edit. Corrections replace status instead of keeping a misleading staff-visible completion. Reports previously read, copied or otherwise retained outside DayBridge cannot be remotely erased.

| Transition | Reporting behavior |
| --- | --- |
| Staff access revoked | Subsequent API and database report reads denied; access audit retained |
| Staff password reset | First-password-change and post-reset session requirements apply |
| Participant suspended | Consent ended, selections removed and current reports withdrawn; seat remains assigned |
| Participant removed | Consent ended and current reports withdrawn; no longer in report roster; personal records remain |
| Participant restored | No sharing resumes; fresh consent and item selection required |
| Court or reporting flag disabled | Current consent ended and reports withdrawn; re-enable does not resume selections |
| Participant item deleted or loses eligibility | Current report withdrawn atomically on private cloud save |
| Attendance/task completion undone | Current status corrected atomically on private cloud save |

Every successful enabled staff report read writes its filter scope into the report-access audit in the same transaction. An audit insertion failure denies the read. Disabled availability probes and rejected reads do not create successful-access entries. Existing account-administration audit logs are unchanged. Audit retention follows the existing court audit approach: no automatic deletion/TTL is introduced; agree a retention/export policy before real reporting rollout. Infrastructure administrators retain their existing privileged database capabilities.

## API surface

- GET/POST `/api/participant/reporting`: participant-only settings/history; strict actions consent/share/unshare. No client-supplied actor/court or arbitrary reporting event payload.
- GET `/api/admin/progress`: existing staff guard plus database authorization. Court, UTC start/end, optional participant and approved category. Period must be 1–93 days.
- GET/PATCH `/api/owner/reporting`: owner-only boolean availability; no progress data.

All responses use private/no-store. Mutations use bounded JSON and same-origin validation. The report GET also rejects cross-origin requests. These paths are not added to any service-worker cache. Service keys remain server-only.

## Limits and unverified behavior

- Local disposable PostgreSQL and browser fixtures are test evidence, not evidence that hosted reporting works. No production migration, setting change, deployment or real participant backfill is authorized or performed.
- No hosted staging environment was provisioned. Before deployment approval, exercise these APIs with real test Auth sessions and this migration on an isolated test project, run hosted database advisors, and review contention/query plans on representative data.
- Recurring schedules contribute saved occurrences only. Future unsaved occurrences are not generated. Nonrecurring selected appointments can show Upcoming. No denominator claims that all scheduled obligations are represented.
- Scheduled timestamps without an offset use the appointment timezone; task due times use profile timezone. Filters and weekly/monthly boundaries use UTC. Invalid dates yield unknown/no report rather than inferring misconduct.
- At most 100 selected sources per participant. Staff detail responses show the latest 500 matching entries and explicitly mark truncation; aggregates cover all matches. Roster responses are limited to 1,000 accounts and mark truncation. The initial pilot is 25 participants; large-court pagination is future work.
- The staff screen refreshes every 60 seconds and on filter changes/manual refresh. An already open screen or previous copy cannot be remotely erased at the moment permission is revoked; subsequent protected reads fail and clear report contents.
- Participant history retains current sanitized item states and consent changes, not every prior attendance version. Consent text and retention rules require program review before actual use.
- No independent verification, official compliance classification, AI features, medication reporting, GPS monitoring, report emails or automatic staff exports are implemented.

## Deployment and rollback gate

One branch, `codex/consented-court-progress`, contains this implementation and tests. Vercel Git deployments are disabled for this exact branch in vercel.json to avoid a preview deployment. Do not merge or apply the migration to production without owner approval.

After isolated hosted validation and explicit deployment approval, apply only the new migration, merge the approved application change, and keep all court flags disabled during the initial pilot. Demonstrate first with fictional accounts in a separately approved test court/environment. Enabling availability requires a separate explicit owner choice; it grants no consent.

For rollback, first turn off availability for any test court through the owner setting (withdraws consent), then revert the application change. The additive tables can remain disabled without changing existing accounts or personal records. Do not drop the private snapshot table or replay historical migrations. Preserve reporting/access audit records according to the agreed retention policy.
