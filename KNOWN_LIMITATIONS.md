# DayBridge Known Boundaries & Operational Limitations

1. **Self-Reported Documentation Only:**
   DayBridge records personal, user-entered attendance and dose actions. It does not interface with court electronic monitoring hardware, biometric breathalyzers, or electronic health records (EHR). Attendance reports contain an explicit notice that they are not certified by a court officer.

2. **No Bank Account Syncing:**
   Account balances and transactions are recorded manually. This protects user privacy by eliminating financial aggregators (e.g. Plaid) and avoiding credential exposure. If account balances are not confirmed for >7 days, Safe-to-Spend displays an "Estimate" advisory.

3. **Operating System Push Limitations:**
   Web Push notifications delivered to mobile PWAs depend on OS-level power modes, battery optimization policies, and Apple APNs / Google FCM delivery. If an iPhone or Android device is in restrictive power-saving mode, push notifications may be deferred by the operating system. An optional device calendar (.ics) backup is recommended for critical hearings.

4. **Single-User Architecture:**
   The application is engineered strictly for a single authorized human user. There is no multi-tenant organizational structure, staff portal, or supervisor assignment feature.
