# Deploy runbook — turn the Offers areas ON (offer-source cutover)

**What this does:** points the follower offer shelves at where your offers actually
live (creator assignments + engagement showcase + store-direct) and turns them on.
**No mobile/OTA rebuild needed** — the app already has the offer shelves; they're just
empty. The backend fills them. There's an instant kill-switch (the env flag).

Run these on YOUR machine (the sandbox that wrote the code can't reach prod). Commands
assume you're in the repo root `C:\WORK\inflx-platform`. Use git-bash for the
`ENV_FILE=...` syntax, or the PowerShell variants noted.

---

## STEP 1 — Confirm prod has the offer data (decides everything)
```bash
cd backend && ENV_FILE=.env.prod-backup node scripts/check-offer-data.js
```
PowerShell: `cd backend; $env:ENV_FILE=".env.prod-backup"; node scripts\check-offer-data.js`

Read the output:
- `has_brand_offers=false` → the offer-engine tables are NOT on prod yet → do **STEP 2**.
- `has_brand_offers=true` → skip STEP 2, go to STEP 3.
- Note the counts: `conversion_attached` / `engagement_attached` / store `n`. These are
  exactly which shelves will light up. If conversion+engagement are both 0 and only store
  has rows, only the brand-published store deals appear (expected, not a bug).

## STEP 2 — (only if STEP 1 said the tables are missing) apply offer-engine migrations
```bash
cd backend
ENV_FILE=.env.prod-backup node scripts/run-084.js   # offer library (brand_offers)
ENV_FILE=.env.prod-backup node scripts/run-085.js   # store-direct columns
ENV_FILE=.env.prod-backup node scripts/run-086.js   # engagement promoted offers
```
These are additive + idempotent. Re-run STEP 1 to confirm `has_brand_offers=true`.
> If the tables already existed, your real offers are already in them — nothing to import.

## STEP 3 — Run the test gate (must be green before push)
```bash
pnpm qa
cd backend && npx jest brandOffers.adapter   # the new adapter unit suite
```
- `pnpm qa` green = no regression. (Known flake: if the 6 API auth-invariant tests time
  out, re-run once — a second run goes 79/79 green. Classify as flake, not a failure.)
- The adapter suite proves the offer normalization + ranking logic.
- If anything genuinely fails, STOP and tell me — do not push.

## STEP 4 — Push (Render auto-deploys the backend)
```bash
git push origin main
```
This deploys the new code with the switch still **OFF** → followers see no change yet.
Wait for Render to finish the deploy (dashboard shows "Live").

## STEP 5 — Flip the switch (the actual "on")
In the Render dashboard → your backend service → **Environment** → add:
```
SECTION_ENGINE_OFFERS = true
```
Save. Render restarts the service. **Offers are now live.**
> Kill-switch: set it back to `false` (or delete it) + restart → instantly back to today's
> behaviour, no code change, no redeploy of anything else.

## STEP 6 — Make sure the offer shelves are switched on
Open `inflx.in/admin` → **App Sections**. Confirm the offer shelves (What's Hot, Best
Deals, Biggest Discounts, the Offers tab rails) are **enabled** for Home / Offers. If any
are hidden, toggle them on — changes go live within ~60s. (Some rails were seeded hidden.)

## STEP 7 — Test on your mobile
Open the follower app (no app update needed):
- **Home** → What's Hot / Best Deals / Biggest Discounts should now show your offers.
- **Offers tab** → your conversion + engagement + store offers, with discount tags.
- Conversion offers show the creator + are tracked; engagement offers show the creator as
  showcase (no commission); store deals show with no creator.
If a shelf looks wrong, flip STEP 5 to `false` and tell me what you saw.

---

## What's verified vs. validated-on-deploy
- **Verified (no DB needed):** offer normalization (discount %/₹, creator credit,
  commission-vs-showcase) + shelf ordering — unit-tested.
- **Validated only when you run it on prod:** the actual database reads (no offer rows
  were reachable from the build sandbox). STEP 1 + STEP 7 are that validation.
- **Known limit:** engagement/conversion "top" shelves currently order by discount then
  recency (not by clicks/sales yet) — they still show the right offers; finer ranking is a
  later refinement (needs per-offer counts wired).

## Rollback
- Soft (instant): STEP 5 flag → `false`.
- Hard: `git revert <commit>` of the offer commits + push. No DB state to unwind (the
  migrations in STEP 2, if applied, are additive and harmless to leave).
