# Incident response and monitoring

Date: 2026-10-23. Runbook ready for assignment; no real incident response, credential rotation or access revocation executed. Sponsor must name a security incident lead, privacy/legal lead, technical operator and participant-support contact before enrollment. Do not invent working phone/email contacts.

## Detection and minimal evidence

Public `/api/health` provides liveness/version only, not database/provider health. `/api/version` identifies a deployment. The secret-protected scheduled route returns aggregate checked/accepted/failure counters independently for reminders and travel. New database audit records snapshot saves and device enable/disable transitions with UUID/time/revision, never record content. It does not capture all reads, administrator operations, successful logins or OS display/acknowledgment.

Deploy an approved availability monitor only after permission; no paid monitor was enabled. Proposed alerts: two consecutive liveness failures; three missed minute dispatches; persistent provider failures; unusual device-registration volume; Auth brute-force warnings; unexpected service-key use; database advisor regression; backup failures; 70/90% storage/API budget thresholds. Counts must not include medication, budget or location values as labels. Cron failure counters alone cannot detect a scheduler that stopped running.

## Triage and containment

1. Open a restricted incident ticket and preserve UTC timestamps, deployment/migration IDs, request IDs and aggregate symptoms. Never put tokens, endpoints, coordinates, medication or financial content into GitHub issues/chat. Restrict traces/dumps and record evidence custody.
2. Establish severity: suspected cross-user access, key compromise or data alteration is urgent; provider-only reminder delay still requires participant safety/continuity assessment. Determine affected time window and accounts in the protected environment without broadcasting their data.
3. Contain the exact affected path. Depending on verified cause, temporarily suspend dispatch, block a route, revoke a compromised session/key or pause enrollment. Obtain required owner authorization for live access/credential changes; emergency authority must be established by the sponsor beforehand. Do not wipe records, reset the database or disable RLS.
4. Preserve an encrypted recoverable copy before corrective migrations. For leaked keys, rotate through provider tooling and update only the affected environment, with a controlled release and rollback plan. Session revocation/access-token expiry and offline copies require separate handling.

## Investigation and restoration

Review Auth/provider audit logs, deployment changes, RLS grants/functions and minimal application security events. Treat external log retention and completeness as unverified until tested. Compare integrity in a controlled environment, patch with synthetic regression evidence, restore into an isolated target first, then get explicit production approval. Re-test three-account isolation and current features before reopening enrollment. Avoid restoring a backup over valid newer records without a reviewed reconciliation plan.

## Privacy and communication

The privacy/legal lead determines applicable HIPAA, Part 2, state, consumer and contractual obligations, reportability, recipients and deadlines. This runbook does not assert a single deadline covers every scenario. Prepare reviewed participant notices describing facts, impacts, practical steps and a real contact. Do not send case details to courts by default. No messages to participants or third parties were sent as part of this work.

## Follow-up

Document cause, containment, restored cutoff, affected scope and corrective actions. Review least privilege, consent and retained evidence. Assign prevention owners and dates. Run a synthetic tabletop exercise before the pilot and after material changes; record actual results rather than marking an unexecuted exercise complete.
