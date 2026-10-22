# DayBridge AI Studio Implementation Pack

**What this is:** A complete product/engineering specification designed to be pasted into Google AI Studio Build mode to create a private, daily-use personal organizer on **Vercel + Supabase**.

## Files
- `DAYBRIDGE_MASTER_PROMPT.md` — the primary full implementation instruction. Paste this first.
- `SUPABASE_SCHEMA.sql` — security-first draft SQL migration and data contracts. Review in dev; do not execute blindly on production.
- `BUILD_SEQUENCE.md` — sequenced follow-up prompts and manual infrastructure setup steps.

## Workflow
1. Visit https://aistudio.google.com/, open **Build**, and choose Web app.
2. Paste the **entire master prompt**. AI Studio can generate full-stack web projects but does **not** necessarily use Next.js by default; the prompt explicitly targets Next.js on Vercel.
3. Supply the SQL as context/reference for the database stage. Keep secrets out of the prompt.
4. If it produces a UI-only demo, send the next phase prompts from `BUILD_SEQUENCE.md` until every required save reaches Supabase and acceptance tests pass.
5. Sync the generated repository to a **private GitHub repo**; configure Vercel yourself and securely provide environment variables there. Do not use AI Studio's Cloud Run one-click publish for this target architecture.
6. Create a **separate new Supabase project**, disable public signups and validate owner-level Row Level Security before entering any actual personal records.
7. Do not describe the app as production-ready until authentication, safe notifications, real database CRUD, tests and device verification are complete.

**Scope:** Personal use only. No manager, court, therapist or employer has automatic access. Weekly report is explicitly self-reported and shared manually only if you choose.

**Important:** This pack is a **design and implementation instruction**, not a completed deployed application. The SQL file is unexecuted and needs validation, changes through version-controlled migrations, and testing against the actual Supabase project.
