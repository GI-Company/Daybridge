# HIPAA and healthcare privacy readiness

Review date: 2026-10-23. Engineering assessment for preliminary review, not certification or a legal determination. Initial user scope was personal use; the later pilot specification introduces different institutional scenarios. No contract, paid compliance add-on or production setting was activated.

## Applicability decisions

| Scenario | Working assessment | Required decision before use |
|---|---|---|
| Independently chosen personal organizer | Self-entered medication data is not automatically HIPAA PHI in this app | Confirm operator relationships and applicable consumer/state privacy duties; preserve participant control |
| Court-sponsored, no covered-provider records | Sponsorship alone does not settle HIPAA applicability; court records can remain highly sensitive | Counsel reviews court role, provider connections, consent/coercion, subpoenas, state confidentiality and consumer-health rules |
| Provider-sponsored | Operating for a covered provider may create a business-associate relationship | Define services/data flows and BA/subcontractor roles before accepting records |
| Processing PHI for a covered entity or BA | Treat as regulated pending qualified assessment | Executed BAAs, approved processors, risk analysis and tested administrative/physical/technical safeguards before processing |

The distinctions follow [HHS health app developer scenarios](https://www.hhs.gov/sites/default/files/ocr-health-app-developer-scenarios-2-2016.pdf). HHS explains that a cloud processor maintaining ePHI can be a BA even if it cannot decrypt the data; encryption is not a substitute for a BAA or risk analysis. See [HHS cloud guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/cloud-computing/index.html).

## Safeguard gap matrix

| Domain | Present / candidate technical control | Gap / accountable approval |
|---|---|---|
| Risk management | Threat model, severity register, isolated negative tests | Organization names security/privacy owners, accepts residual risks and schedules reassessment |
| Identity and access | Owner RLS, server-only credentials, no court access; optional device lock | Verify closed signup, admin MFA, least-privilege dashboard roles, secure provisioning/recovery and revocation |
| Audit | Candidate snapshot/device metadata; provider logs | No full read/access/admin audit, centralized alert retention or tamper-evident external archive |
| Integrity | Revision CAS, history, encrypted local queue, explicit medication action | No automatic merge/tombstone log; real concurrent hosted tests and conflict-recovery UX drill required |
| Transmission | HTTPS, fixed provider destinations, Web Push encryption | Validate each external data flow and vendor contract; routes/search may identify sensitive locations |
| At rest / devices | AES-GCM browser snapshot with origin-held key | No E2EE, hardware-backed independent key, remote wipe or proof of all hosted encryption settings; device policy needed |
| Recovery | Disposable archive and snapshot recovery tests | Hosted project/auth restore, backups outside failed account, measured RPO/RTO unverified |
| Workforce / physical | No staff-facing record access added | Training, sanctions policy, workstation/device controls, access reviews and incident ownership not established |
| Retention / rights | Explicit export warning, retained revision history | Approved retention, complete deletion, consent/withdrawal workflow and backup expiry not implemented |
| Breach response | Incident runbook | Counsel-approved legal timelines, contacts, drills and vendor notification terms required |

## Processor prerequisites

Supabase requires a signed BAA and HIPAA add-on for PHI; High Compliance project configuration includes recovery and network/TLS controls. No evidence was obtained that these are active here. Follow [Supabase HIPAA Projects](https://supabase.com/docs/guides/platform/hipaa-projects) and its [shared responsibility model](https://supabase.com/docs/guides/deployment/shared-responsibility-model#managing-healthcare-data); obtain current written scope and pricing before purchase.

Vercel offers a BAA option on Pro; the user's existing free setup does not establish covered service scope. Confirm contractual coverage for Functions, logs, middleware and relevant regions. See [Vercel BAA availability](https://vercel.com/changelog/hipaa-baas-are-now-available-to-pro-teams). No BAA was signed or verified.

TomTom, push transport, OS notification presentation, optional external navigation and any future analytics must each be reviewed for what is disclosed and whether approval/contracts are required. No healthcare contract was verified for them. Do not introduce protected treatment/provider data into these paths based on this assessment. GitHub and observability tools must receive synthetic artifacts only until appropriate handling is approved.

## 42 CFR Part 2

If records from a federally assisted SUD program are introduced, obtain a separate Part 2 assessment covering consent, redisclosure, segregation, permitted uses and proceedings restrictions. A personal medication entry alone does not settle applicability. Current owner-only snapshots have no Part 2 consent or disclosure segmentation engine. Do not use exported records for sanctions or court proceedings by default. [HHS Part 2 fact sheet](https://www.hhs.gov/hipaa/for-professionals/regulatory-initiatives/fact-sheet-42-cfr-part-2-final-rule/index.html) describes the protected program-record context and restrictions on proceedings.

**Regulated-data recommendation: NO-GO** until legal scope, contracts, project configuration and operating safeguards are verified. Security improvements do not establish HIPAA compliance.
