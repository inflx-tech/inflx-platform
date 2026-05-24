# 06 · Diff notes — Flow 10 (brand-web proposals inbox)

## Verdict

Visual + UX restyle to locked palette + 1 backend field surfaced
(`influencer_niches` was already in the `listForBrand` SELECT but
unused) + per-tab counts derived from already-loaded array. Same 8
endpoints, same settings shape, same modal action gating + view-mark
semantics, same tier thresholds. Pure visual + UX change.

## Files touched

| File | Type | LOC (new) | LOC (old) |
|---|---|---:|---:|
| `Packages/brand-web/app/dashboard/proposals/page.js` | rewrite | 720 | 411 |

Growth from: CSS block (~250 lines for locked palette + .prp scoping discipline + buttons + 4 status pill tones + chip selectors + 3 modal mode panels), niche-chip rendering with overflow, per-tab count derivation, relative-date helper, empty-state conditional CTA.

## What changed (UI/UX)

- **Palette**: wave1 (`bg-amber-100 / bg-blue-100 / bg-purple-100 / bg-teal-100 / bg-navy / text-navy / bg-surface2`) → locked wave2 (white surfaces + #FAFAFA bg + #0A0A0A ink + #FFC107 yellow + JetBrains Mono on every ₹/@handle/date)
- **Layout**: HTML table → row-card layout (better for variable-length pitch content + responsive on smaller screens)
- **Header**: Outfit H1 "Influencer Proposals" + yellow rule + mono count chip ("N pending" / "N <status>") + ghost Settings toggle
- **Status tabs**: locked palette with **mono per-tab counts** (NEW — derived from already-loaded array; falls back to '·' when on a filtered tab since server-side filtering doesn't return other-status rows)
- **Row card**: avatar (2-letter initials) + name + @handle + tier pill + city · **niche chips (NEW from `influencer_niches`)** — 3 visible + "+N" overflow chip · pitch title + truncated message preview · right: mono ₹ ask + commission % + status pill + relative date
- **Status pills** semantic tones: sent=yellow-pale · viewed=info-blue · countered=conv-purple · accepted=success-green · rejected=danger-red · expired/withdrawn=muted
- **Empty state** (NEW yellow-pale gradient card) with conditional CTA — when `accepts_proposals=false`, nudges toward Settings ("Turn on proposals →"); when true, just informational
- **Warning banner**: when accepts_proposals=false, yellow-pale card with ! icon + "Open settings →" CTA
- **Settings panel** (collapsible): locked palette · yellow-accent switch for accepts_proposals · ink-active tier chips · ink-active niche chips · checkbox+inputs row · ink Save button. Replaces OLD navy-button styling.
- **Detail modal**: 3-tile mono stats (Followers / ER / Tier) replace OLD compact stat row · pitch in muted bg card · k/v rows for terms · portfolio links with mono dashed-underline · action footer (Decline ghost / Counter yellow / Accept ink+yellow) when status in [sent, viewed] · reject mode panel · counter mode panel
- **Relative date** ("2h ago", "Yesterday", "3 days ago") instead of the OLD absolute date — easier to scan inbox at a glance

## NEW use of already-loaded backend field

`backend/src/services/proposal.service.js:179-181` SELECT joins
`influencers.niche AS influencer_niches` into the response — but the
OLD page never rendered it. Now consumed: per-row niche chips (max 3
visible + "+N" overflow) give brands instant audience-fit context
before opening the detail modal. Defensive normalisation handles
PostgreSQL text[] OR JSON-pickled string variants.

## NEW: per-tab counts

OLD page showed plain tab labels with no counts. New page derives
counts client-side from the already-loaded `proposals[]` array (zero
extra API call). Caveat surfaced in code comment: when the user is on
a filtered tab the server returns only that subset, so other-tab
counts can't be derived; we show '·' for those (active tab keeps the
real count). When on "All", every per-tab count is accurate.

## CSS scoping discipline (day-1 — durable rule applied)

- All rules scoped under `.prp` wrapper (specificity 0,2,0 — wins over global Tailwind utilities)
- Every `:hover:not(:disabled)` re-asserts `color` (prevents the cascade dropping yellow text → ink-on-ink invisible class of bug from Flow 7)
- Every `:disabled` locks both `background` + `color` (not just `opacity`)
- Same locked rule as Flow 7 patch + Flow 8 preventive + Flow 9 day-1

## NO-TOUCH preserved

- `proposalApi.{list, get, accept, reject, counter, getSettings, updateSettings, flag}` (8 methods)
- Settings JSON shape: `{ accepts_proposals: bool, proposal_filters: { min_tier, allowed_niches[], city_match_required, min_engagement_rate, only_past_collabs } }`
- Modal action gating (`['sent', 'viewed'].includes(proposal.status)`)
- Tab keys: `['', 'sent', 'viewed', 'countered', 'accepted', 'rejected']`
- Tier derivation thresholds (Nano <10K · Micro <100K · Macro <1M · Mega ≥1M)
- View-mark semantics (preserved — row click does NOT call `get(id)`; matches OLD)
- `confirm(...)` dialog message format for accept
- Brand-approval gate from layout.js
- Counter mode field pre-fills (proposed_fee + proposed_commission_pct)

## QA gate

```
pnpm qa  (2026-05-24T07:59:02Z)
73/73 passed · 0 failed · 0 skipped · gate 0 · STATE=GREEN
Duration: 1.5m
Report: qa/reports/2026-05-24T07-59-02-959Z/QA-REPORT.md
```

First run clean. **Test count grew from 71 → 73** since Flow 9 — Window
A pushed 2 new tests in `qa/web/brand/subscription-billing-nav.spec.ts`
covering their Phase A6 admin + brand subscription/billing nav routes.
Those pass clean, suggesting Window A's recent backend work (likely
running the missing `tier_key='free'` seed insert from
`features/backend-defect-quota-check-missing-free-tier/`) has also
likely resolved the production 500 founder hit on Flow 7's wizard.
Worth a smoke-test on prod after Flow 10 ships to confirm.

## Governance gates

- Rule 1 (approved contract) ✓
- Rule 2 (release evidence at flip) ✓ — qa_all_green=true with first-run-clean evidence
- Rule 3 (mockup_locked) ✓
- Rule 4 (06-diff/notes.md present) ✓ (this file)
- Rule 5 (Maestro) does NOT fire — web only

## Deploy classification

PRODUCTION-IMPACTING (web only). `git push origin main` → Vercel
auto-deploys brand-web. NO mobile, NO OTA, NO backend rebuild.
