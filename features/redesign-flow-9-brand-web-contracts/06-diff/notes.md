# 06 · Diff notes — Flow 9 (brand-web contracts inbox)

## Verdict

Visual + UX restyle to locked palette + 2 backend fields surfaced
(`formats_json` + `followers_count`) that were already in the
`listBrandPending` SELECT but unused in the OLD render. Same 3 endpoints,
same selection logic, same bulk-sign confirm flow, same wallet-short
gating. Pure visual + UX change.

## Files touched

| File | Type | LOC (new) | LOC (old) |
|---|---|---:|---:|
| `Packages/brand-web/app/dashboard/contracts/page.js` | rewrite | 390 | 194 |

Growth from: CSS block (~150 lines for locked palette + .cts scoping),
always-visible wallet status strip (vs only-when-selected before), tier
pill derivation helper, format chip helper, empty-state card.

## What changed (UI/UX)

- **Palette**: wave1 (`bg-navy / text-navy / bg-surface2 / bg-red-50`) → locked wave2 (white surfaces + #0A0A0A ink + #FFC107 yellow + JetBrains Mono on every ₹/@handle/date/followers)
- **Layout**: single column max-w-5xl (inbox surface, no right rail needed)
- **CSS scoping discipline applied from day 1**: all rules scoped under `.cts` (specificity 0,2,0). Every `:hover` re-asserts `color` explicitly. Every `:disabled` locks bg+color. Same pattern as Flow 7 post-patch + Flow 8 preventive patch.
- **Header**: count chip ("N pending") above Outfit H1 + yellow rule + ghost Refresh button (right)
- **Wallet status strip** (NEW, always visible — was only-when-selected before): ink card with `Wallet ₹X | Selected lock ₹Y + progress bar | Top-up link`. Bar fills as user ticks rows. Turns red when total > wallet, shows "Short ₹Z" chip + "Top up to enable" nudge in the bulk bar.
- **Sticky bulk action bar**: select-all checkbox + count + "lock total ₹X" + ink "Sign selected (N)" button. Border + shadow when at least one row selected.
- **Contract row card**: checkbox + @handle (mono) + **tier pill** (Nano/Micro/Macro/Mega derived from `followers_count`) + goal pill (engagement/conversion/hybrid) · meta line: campaign + signed date + production-mode pill · **format chips** (NEW from `formats_json` — e.g. "2 reels · 3 stories") + **followers chip** (NEW from `followers_count` — mono "142K followers") · right side: mono Lock ₹ + optional `base + bonus` breakdown · Review → link
- **Selected row state**: yellow-50 background + ink border + yellow-pale ring (matches Flow 7 + Flow 8 selected patterns)
- **Empty state** (NEW): yellow-pale gradient card with ✓ icon + "All caught up" + CTA → `/dashboard/campaigns`

## NEW use of already-loaded backend fields (no backend touch)

The `listBrandPending` controller SELECT joins `campaign_sets.formats_json`
and `influencers.followers_count` into the response — both were loaded but
unused in the OLD render. Now consumed:

- `formats_json` → rendered as small mono format chips ("2 reels", "3 stories") per row so brands see workload at a glance before signing
- `followers_count` → mono "142K followers" chip + auto-derived tier pill via standard thresholds (Nano <10K · Micro <100K · Macro <1M · Mega ≥1M)

Verified via `backend/src/controllers/contract.controller.js:1171-1205` —
both fields are in the SELECT today.

## NO-TOUCH preserved

- `contractApi.{listPending, bulkSign}` (2 methods)
- `walletApi.getBalance` (1 method)
- Selection set + `toggle` + `toggleAll` semantics (verbatim)
- Bulk-sign `window.confirm(...)` dialog message format (count + lock total)
- Wallet-short button gating (client mirror of server enforcement)
- Page-load parallel fetch order
- Review link target (`/dashboard/campaigns/{campaign_id}`) — points at Flow 6 hub
- Brand-approval gate from layout.js
- Error / success message banner pattern

## QA gate

```
pnpm qa  (2026-05-24T06:30:32Z)
71/71 passed · 0 failed · 0 skipped · gate 0 · STATE=GREEN
Duration: 1.2m
Report: qa/reports/2026-05-24T06-30-32-722Z/QA-REPORT.md
```

First run clean. No spec re-baseline needed (no spec asserts on
`/dashboard/contracts` copy/layout).

## Governance gates

- Rule 1 (approved contract) ✓
- Rule 2 (release evidence at flip) ✓ — qa_all_green=true with re-cert evidence
- Rule 3 (mockup_locked) ✓
- Rule 4 (06-diff/notes.md present) ✓ (this file)
- Rule 5 (Maestro) does NOT fire — web only

## Deploy classification

PRODUCTION-IMPACTING (web only). `git push origin main` → Vercel
auto-deploys brand-web. NO mobile, NO OTA, NO backend rebuild.
