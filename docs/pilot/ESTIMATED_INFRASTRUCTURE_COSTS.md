# Infrastructure estimate for a 90-day pilot

Planning date: 2026-10-23. USD before tax; estimates, not purchased services or a vendor quote. Existing personal production stays on its current plan. Prices/entitlements must be reconfirmed before approval. No subscription was enabled.

## Baseline scenarios

| Scenario | Monthly planning floor | 90-day floor | Exclusions |
|---|---:|---:|---|
| Existing personal setup | $0 base if current free quotas suffice | $0 base | No institutional availability/backup guarantee; usage/plan limitations |
| Non-regulated institutional pilot, one production project | $45: Vercel Pro $20 + Supabase Pro from $25 | $135 | Overage, recovery enhancements, staging, email, monitoring, domain, support and labor |
| Same, one additional Micro staging database | About $55 base | About $165 | Subject to organization compute credits and project billing; staging hosting usage additional |
| Potential regulated deployment | At least $969 base + unquoted Supabase HIPAA add-on + recovery/compute/usage | At least $2,907 + add-ons | Not a complete compliance budget; vendor approval and written coverage required |

The regulated floor uses Supabase Team from $599 plus Vercel Pro $20 and its published $350 BAA add-on. Supabase lists HIPAA as a paid Team/Enterprise add-on without an amount on its pricing page; obtain a written quote. Do not assume Supabase Pro alone provides the necessary BAA arrangement. Supabase PITR starts around $100/month for seven days and requires at least Small compute; neither is activated or included in the floors. See [Supabase pricing](https://supabase.com/pricing), [backup pricing](https://supabase.com/docs/guides/platform/backups), and [Vercel pricing](https://vercel.com/pricing).

Hobby is restricted to personal/non-commercial use; obtain plan eligibility review before an institutional deployment. Paid plans do not themselves establish legal compliance. See [Vercel Hobby terms/limits](https://vercel.com/docs/plans/hobby).

## Capacity model and scaling risks

Use 30 participants, 20 saves/person/day, 100 KiB uncompressed snapshot, 30 days/month and 90 days total as an explicit **assumption**, not a measured production record size. Full retained history then adds 54,000 snapshots, about 5.15 GiB over 90 days before indexes, other tables and compression. Free Supabase's 500 MB is not a credible budget for that assumption. A 30-day history window would still be about 1.72 GiB, but no retention purge is approved or implemented.

The reminder monitor currently reads each active push account's snapshot every minute. At 30 accounts and 100 KiB, that is approximately 1.296 million reads / 123.6 GiB transferred per month before travel reads and other usage. Repeated full JSON scans and serial delivery work require load measurements before enrolling 20–30 people; a fast empty-account cron response is not proof of pilot capacity. Consider a separately reviewed due-item index/queue if measured runtime, egress or memory warrants it, preserving privacy and migration integrity.

At 30 people × 2 map views/day × 60 raster tiles/view × 30 days, estimate 108,000 street requests/month before retries/traffic layers. At 2 trips/person/day and 20 calculations/trip, estimate 36,000 route requests/month. These are examples to budget, not actual usage. Current [TomTom pricing](https://docs.tomtom.com/pricing) lists API-specific monthly allowances; routing's displayed 20,000 and raster's 200,000 are different budgets, and traffic/search have their own limits. Verify the existing key's product/tier rather than assuming the public allowance applies to a legacy contract. Set quotas and review maps-provider terms/regulated disclosure before expansion.

One once-minute dispatcher produces about 43,200 Edge invocations and Vercel scheduled HTTP requests per 30 days, plus browser APIs, tiles and retries. A job can approach the configured 60-second Vercel duration when many users/devices/routes are processed; concurrent minute runs and slow providers need a synthetic hosted load test. Existing per-scope API rate limits prevent one class of burst but are not a monthly financial cap.

## Operating budget and approval

Assign an operator to inspect database/history size, egress, function runtime/errors, map API counts, push failures and backup health weekly, daily during onboarding. Proposed alerts at 70% and 90% of approved budgets need actual monitoring configuration and named recipients. Keep counters free of health/location/budget labels. Confirm spending caps with owners before paid activation. Include support, device assistance, security/legal review and incident/recovery labor in a grant budget; these floors omit all labor and cannot be quoted as total pilot cost.
