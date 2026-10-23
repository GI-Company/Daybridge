# DayBridge working instructions

- Push completed changes directly to `main`. Do not create feature branches, pull requests, or preview deployments unless the user explicitly requests them.
- The user is on a free Vercel account and tests the app in production. Batch related changes into one main push, use the existing Git integration for the production deployment, and avoid duplicate deploys or empty deployment-trigger commits.
- Run appropriate local automated checks before pushing, then verify the production commit and live behavior. Do not present fixture-based browser tests as proof of working production services.
- Keep the map fully interactive. Do not substitute static images or fabricated route geometry for broken map functionality.
