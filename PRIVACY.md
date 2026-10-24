# DayBridge privacy description

Updated October 2026. This describes the participant-controlled organizer and candidate pilot design, not a substitute for an approved institutional privacy notice.

DayBridge handles user-entered schedules, self-reported attendance, medication/dose history, manual financial records, contacts and saved locations. No court-staff portal, automatic sanctions feed, adherence score or cross-participant sharing role exists. Attendance and dose entries are participant reports, not independently certified evidence.

Records synchronize to owner-scoped Supabase snapshots and retained history. The device holds an encrypted cache with a key in the same origin; infrastructure administrators/service credentials can access server records. Do not interpret “private” as a promise that the operator or hosting processors cannot access them. Account administration should not become permission to inspect participant records; organizational least privilege and auditing remain necessary.

Supabase processes Auth/data; Vercel handles app/server operations; TomTom processes maps/search/routing inputs. Google/Apple/Mozilla push transports deliver encrypted notifications, and the OS controls display. Opening external navigation explicitly shares a route with the chosen maps provider. Sensitive destinations can reveal context even without medication names. No analytics or AI inference feature is integrated in the current source.

Routine push text is generic; traffic messages, link IDs, timing and lock-screen behavior can still reveal context. Delivery never records a dose or attendance. Participants control entries and explicit exports. Exports are unencrypted JSON and cannot be remotely recalled. Deleting a current item does not erase historical snapshots or backups; complete account erasure and approved retention are not yet implemented. See [retention/deletion](docs/pilot/DATA_RETENTION_AND_DELETION.md).

A pilot needs an approved notice, actual contact/withdrawal process, voluntary consent, vendor review and a separate legal assessment before introducing provider or protected treatment records. Future sharing needs narrowly scoped authorization and review. See [data inventory](docs/pilot/DATA_FLOW_AND_CLASSIFICATION.md) and [HIPAA/Part 2 gaps](docs/pilot/HIPAA_READINESS_GAP_ANALYSIS.md). No automatic sharing with courts or providers was added in this branch.
