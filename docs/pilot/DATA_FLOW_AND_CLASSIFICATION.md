# Data flow and classification

Date: 2026-10-23. Read with [architecture diagram](SYSTEM_ARCHITECTURE.md). “Sensitive” is a product classification; legal PHI status depends on relationships and use.

| Information | Classification | Storage / disclosure | Minimization and residual risk |
|---|---|---|---|
| Auth identity, email/legacy alias, session | Restricted credential/identity | Supabase Auth; browser SDK storage/cookies | No plaintext password storage; script-accessible session; no alias mailbox recovery |
| Event title, court/therapy category, time, attendance, notes | Sensitive participant record | Encrypted device snapshot; owner cloud snapshot/history; scheduler | Self-report; no staff sharing; operators can access cloud data |
| Medication, schedule, dose history, stock | Sensitive health-related | Same snapshot/history; server reminder computation | Push routine body generic; no inference from delivery to dose completion |
| Budget balance, bills, advances, contacts | Sensitive personal/financial | Same snapshot/history and explicit export | Manual ledger; no bank credentials; exports unencrypted |
| Saved home/work/place addresses; route origin/destination | Sensitive location | Snapshots, travel tables; authenticated server to TomTom | TomTom receives coordinates/search/address and server IP; destination can imply treatment. No continuous closed-app GPS |
| Map tile coordinates, search terms and route request | Sensitive contextual | Vercel proxy -> TomTom APIs | Keys server-only; tile requests still reveal viewed geography; no promise of anonymity |
| Push endpoint, encryption keys, pseudonymous account target | Restricted delivery credential | Supabase subscription table; server sender; browser Push API | Candidate hides keys from direct authenticated reads and validates provider hosts. Endpoint is a capability; never log it |
| Push message | Sensitive contextual | Encrypted Web Push to Google/Apple/Mozilla, displayed by OS | Generic routine text and opaque item IDs; traffic messages may reveal timing/destination context. Lock-screen/OS choice remains relevant |
| Revision, action, account UUID, timestamp | Restricted audit metadata | New `private_security_audit` | No titles, coordinates, medication, money or payload; not anonymous data |
| App shell and hashed assets | Public code | Service-worker cache / CDN | No private API or Supabase response cache; downloaded code may remain offline |
| JSON export or print | Sensitive participant-controlled copy | Participant-chosen device/download/recipient | Explicit export warning; retention and onward disclosure under participant control |

## Vendor and privileged access inventory

Supabase processes identities, snapshots, history, travel plans and notification metadata. Vercel processes authenticated API requests and notification/travel jobs; infrastructure logs may include URLs, IPs and request metadata. TomTom receives map/routing inputs. Apple/Google/Mozilla provide Web Push transport; Apple/Google Maps are optional explicit navigation destinations. GitHub stores source/CI artifacts, never participant fixtures. There is no analytics or LLM feature in the shipped code; the unused GenAI dependency is removed in this branch. No Storage bucket is currently provisioned.

Do not send medication names, event descriptions, court/SUD categories, budgets or account identifiers as map query labels or analytics dimensions. Existing address-based routing can itself identify a sensitive destination; regulated use needs a specific vendor/data-flow decision before activation. Do not claim generic push text alone makes every flow non-PHI.

## Collection, consent and purpose

Participant-selected entries support personal organization. A future pilot needs a plain-language notice explaining processor access, offline copies, reminder limitations, exports, voluntary participation, withdrawal and deletion. No court portal, compliance score, sanctions feed or automatic sharing was added. Administrative account creation does not authorize inspecting participant records. Any sharing scope needs a separate legal/security design and explicit authorization; current RLS is owner-only.

No real participant data is included in test results, browser fixtures, documentation or Git. Never attach production screenshots, exports or network traces to public issues. Review trace/download artifacts as sensitive even when a test was intended to be synthetic.
