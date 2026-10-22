# DayBridge Security Policy & Threat Model

## Overview
DayBridge Personal Edition is architected with a strict privacy-first and defense-in-depth security model. The application is built for one authorized human owner managing personal accountability, healthcare schedules, and manual budgets.

## Assets & Classification
1. **Prescription & Medication Records:** Drug names, dosages, instructions, and dose timestamps.
2. **Accountability & Court Records:** Court classes, hearing dates, location, case worker contact info, and self-reported attendance.
3. **Financial Snapshot:** Manual checking/cash balances, wage advances, and recurring bills.
4. **Authentication & Session Tokens:** Supabase SSR session cookies, WebAuthn credentials.

## Threat Model & Mitigations

### 1. Database Access & Row Level Security (RLS)
- **Control:** Every table in the Supabase schema (`profiles`, `calendar_events`, `event_occurrences`, `tasks`, `medications`, `medication_schedules`, `medication_logs`, `budget_accounts`, `money_transactions`, `paycheck_plans`, `wage_advances`, `bills`, `budget_reserves`, `resource_contacts`, `reminder_rules`, `reminder_occurrences`, `push_subscriptions`) has RLS enabled.
- **Rule:** Strict owner predicate `auth.uid() = user_id` for `SELECT`, `INSERT WITH CHECK`, `UPDATE USING/WITH CHECK`, and `DELETE`.
- **Cross-Tenant Isolation:** Unauthenticated requests and cross-owner queries are rejected at the database engine level.

### 2. Lock-Screen Push Notification Hygiene
- **Control:** Notification payloads dispatched to Web Push services (Apple APNs / Google FCM) contain strictly generic text:
  - *Title:* "DayBridge reminder"
  - *Body:* "Open DayBridge to view scheduled item"
- **Mitigation:** Sensitive medication names, clinician titles, and court appointment descriptions are never sent over notification networks or displayed on device lock screens.

### 3. Client-Side Secrets & Credentials
- **Control:** No privileged keys (`SUPABASE_SERVICE_ROLE_KEY`, database admin passwords) exist in client bundles or `NEXT_PUBLIC_` variables.
- **Verification:** All sensitive server operations and push notifications are handled via isolated server runtime/Edge Functions.

### 4. Zero Third-Party Trackers & Telemetry
- No ad trackers, marketing pixels, or analytics services.
- No medical or court data is transmitted to AI inference models or external LLMs.

### 5. Data Export & Right to Deletion
- The owner can export a complete plaintext copy of all data in JSON format at any time.
- A single-action "Wipe Local Data" affordance deletes local cache and resets application state.
