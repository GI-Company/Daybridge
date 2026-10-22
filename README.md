# DayBridge Personal Edition

A private, mobile-first daily organizer and accountability life-management application for individuals navigating accountability court assignments, treatment programs, and daily living.

![DayBridge Icon](/public/icon.svg)

---

## Key Features

- **5-Second Priority Dashboard:** Answers *What do I do next? Did I take my medication? What can I safely spend? What must I prepare for tomorrow?*
- **Accountability Court & Classes:** Recurring weekly classes, travel buffers, preparation checklists, and personal self-reported attendance tracking.
- **Conservative Safe-to-Spend:** Pure integer-cents ledger deducting unpaid bills, earmarked essentials (gas/transit, groceries), and safety buffer before payday.
- **Wage Advance Protection:** Deducts early wage access (EarnIn/Dave) from expected paychecks to eliminate double-counting spendable money.
- **Medication Management:** Scheduled morning/night doses and PRN logs with unique slot protection, refill runout forecasts, and one-tap Taken / Snooze / Skip actions.
- **Printable Weekly Self-Review:** Clean printable report for personal review or coordinator meetings with optional medication name redaction.
- **Private Resources & 24/7 Crisis Support:** Saved contacts for court officers, therapists, and doctors, with one-tap 988 Crisis Line access.

---

## Technical Architecture

- **Framework:** Next.js 15+ (App Router) + TypeScript
- **Styling:** Tailwind CSS with accessible color contrast and 44x44px minimum tap targets
- **Backend & Database:** Supabase SSR Auth, PostgreSQL with Row Level Security (RLS) on all tables
- **Storage Strategy:** Resilient offline-first local repository with seamless Supabase cloud synchronization
- **PWA Ready:** Web Manifest, icons, standalone display mode

---

## Getting Started

### 1. Local Development
```bash
# Clone the repository
git clone <your-repo-url>
cd daybridge

# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Supabase Deployment Checklist (Manual Owner Setup)

1. **Create a Private Supabase Project:**
   - Log into [Supabase](https://supabase.com) and create a new project.
2. **Disable Public Signups:**
   - In Supabase Dashboard -> **Authentication** -> **Providers** -> **Email**, disable *Enable Signup*.
   - Manually invite or create your single authorized user account.
3. **Run Schema & RLS Migrations:**
   - Open the **SQL Editor** in your Supabase dashboard.
   - Run the contents of `supabase/migrations/20261021000000_daybridge_schema.sql`.
   - Confirm that Row Level Security (RLS) is enabled on all tables.
4. **Configure Environment Variables in Vercel:**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-publishable-key"
   SUPABASE_SERVICE_ROLE_KEY="your-server-only-service-role-key"
   NEXT_PUBLIC_APP_URL="https://your-custom-domain.vercel.app"
   ```

---

## Important Disclaimers

1. **Non-Certification Notice:**
   Attendance recorded in DayBridge is user-entered and self-reported. It does not constitute an official court attendance certificate.
2. **Personal Medical Record Only:**
   Medication schedules and dose logs are personal tracking records and do not constitute clinical guidance. Always follow prescription labels and healthcare provider instructions.
