# DayBridge Automated & Domain Test Documentation

## Automated Unit & Domain Tests (`tests/domain.test.ts`)

All core mathematical, calendar, and medication functions are pure, deterministic, and covered by automated assertions:

| Test Case | Description | Status |
| :--- | :--- | :--- |
| **`parseDollarsToCents`** | Validates string dollar amounts (`12.50`, `12`, `-5.25`) convert to integer cents without floating-point inaccuracies. | PASSED |
| **`calculateSafeToSpend`** | Confirmed balances minus pre-payday bills, essential reserves, and emergency buffer. Ensures spendable cash is clipped to $0 and accurately records shortfall if in deficit. | PASSED |
| **`calculateRemainingPaycheck`** | Deducts wage advances and instant transfer fees from expected net paycheck without double-counting spendable cash. | PASSED |
| **`detectEventConflicts`** | Detects direct schedule overlaps and travel preparation buffer deficits between consecutive obligations. | PASSED |
| **`calculateRefillForecast`** | Computes estimated pill runout dates from inventory and schedule rates, flagging refills when threshold is crossed. | PASSED |

## Acceptance Flow Verifications
1. **Initial Blank State:** Rapid 2-minute onboarding with sensible defaults; user can skip any non-mandatory question.
2. **Weekly Accountability Class:** Created as a weekly recurring Wednesday class, showing travel buffer, prep checklist, and self-reported attendance recording.
3. **Medication Dose Logging:** One-tap `Taken`, `Snooze 30m`, or `Skip`. Slot uniqueness prevents accidental double dose logs.
4. **Advance & Paycheck Calculation:** Recording a $100 advance increases current checking balance by $100 while deducting $100 + fee from the upcoming paycheck forecast.
5. **Printable Weekly Summary:** Generates clean, printer-friendly summary with mandatory non-certification disclaimer and one-click medication name redaction.
