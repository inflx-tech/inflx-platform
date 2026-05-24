# Flow 12 · impact

**Terse verdict (chat):** zero functional / backend / logic / DB impact —
visual + UX only. 3-route bundle restyle.

---

## Files touched

| File | Action | LOC delta |
|---|---|---:|
| `Packages/brand-web/app/dashboard/influencers/page.js` | full rewrite | ~530 → ~520 (lots removed, CSS added) |
| `Packages/brand-web/app/dashboard/influencers/[id]/page.js` | full rewrite | ~278 → ~550 (activity-signal card + locked palette CSS) |
| `Packages/brand-web/app/dashboard/influencers/analytics/page.js` | full rewrite | ~428 → ~560 (palette restyle of charts + locked-palette CSS) |
| `design/wave2/flow-12-brand-web-influencers/web.html` | new mockup | +1,159 |
| `features/redesign-flow-12-brand-web-influencers/01-spec.md` | new | +180 |
| `features/redesign-flow-12-brand-web-influencers/02-workflow.md` | new | +160 |
| `features/redesign-flow-12-brand-web-influencers/03-expected-outputs.md` | new | +160 |
| `features/redesign-flow-12-brand-web-influencers/04-preview/mockups/web.html` | new (mirror) | +1,159 |
| `features/redesign-flow-12-brand-web-influencers/04-preview/workflow-prediction.md` | new | +130 |
| `features/redesign-flow-12-brand-web-influencers/05-impact.md` | this file | +110 |
| `features/redesign-flow-12-brand-web-influencers/06-diff/notes.md` | new (post-impl) | +100 |
| `features/redesign-flow-12-brand-web-influencers/lock.json` | new | +40 |

## NO-TOUCH preserved

- `backend/**` — zero changes
- `backend/migrations/**` — zero changes
- `Packages/shared/api/**` — zero changes
- `Packages/Mobile/**` — zero changes
- `Packages/brand-web/lib/api.js` — zero changes (`influencerApi`, `creatorInvitationApi`, `brandApi.getMe` consumed as-is)
- `Packages/brand-web/app/dashboard/layout.js` — zero changes
- All API call shapes (request bodies, query params, response field names) frozen
- All 5 endpoints + 1 mutation preserved verbatim
- Form field names (in invite modal) — frozen: `ig_handle`, `brand_message`, `proposed_fee`
- Route names `/dashboard/influencers`, `[id]`, `analytics` — frozen
- localStorage / cookies — untouched
- Role + approval gates — unchanged

## What changes (UX + visual)

### List
- Multi-color grid cards (~140-160px tall, 3 per row) → compact single-line row cards (~64px tall, 1 per row)
- Gradient-orange CTA + 6-color tier badges → locked palette
- 6 mini-badges + 6 chip rows per card → just 1 inline intel signal (rank score) + 1 conditional stale tag
- Old fields dropped from card (moved to profile): growth, posting freq, 90d posts, commercial%, biz acct, use cases, languages, past-brand chips
- Hero KPI strip NEW (3 mono metrics)
- Tier chip row palette-aligned with mono counts
- Action button reduced from 2 (View + Add/Invite) to 1 (since the whole row is clickable → profile)

### Profile
- Gradient-orange avatar + gradient navy CTA card → INK hero with yellow accents
- 4-stat tiles restyled to mono numbers
- Engagement bars repalette: red→info, blue→info, green→success, purple→conv, all consistent
- NEW: Activity Signal card on right column — surfaces 7 already-loaded fields
- NEW: `unique_brands_count` shown as header context on past-brands
- NEW: `recommended_use_cases` shown in audience k/v list
- Sticky bottom CTA bar added
- Past brand cards repalette to ink+yellow initials

### Analytics
- 6-color tier rainbow → locked palette (donut + table dots + leaderboard avs)
- Stat tiles repalette to mono numbers
- Donut center text → mono
- Bar charts: yellow / ink / info / green palette grade
- Rate table mono + tier dots
- Leaderboards: avatar bg = yellow-pale + ink text, metric colors palette-mapped

### Cross-cutting
- All numbers / handles / dates / IDs → JetBrains Mono
- All hover/disabled CSS scoped under `.inf` with day-1 discipline
- 2 adjacent-fixes:
  - Profile page IG-verified tick (text-blue-500 cascade trap) — fixed
  - Analytics donut hardcoded 6-color array → palette colors

## Risks · mitigations

| Risk | Mitigation |
|---|---|
| CSS cascade collisions across 3 routes (Tailwind globals winning hover/disabled) | Apply scoping discipline from day 1 in all 3 pages: every rule under `.inf`, every hover re-asserts color, every disabled locks bg + color |
| Field-name drift (e.g. profile page expects `inf.engagement_rate` but scraped returns it under different name) | Backend already aliases for legacy parity (`creator_profiles.follower_based_er AS engagement_rate` — verified in controller). No frontend change required. |
| Activity Signal card rendering on onboarded profiles (legacy `influencers` table) without scraped-only fields | Defensive `{?? '—'}` or conditional render — only show the card when at least one field is non-null |
| Hero KPI 3 (median rate) computed from visible page — misleading if filtered | Label explicitly: "from this page" or use overview-endpoint median if available |
| Activity status color (active vs inactive vs unknown) | Palette mapping: active=success-pale+text, inactive=bg2+muted, unknown=bg2+muted-2 |
| Donut color count exceeds palette (6 tier colors needed) | Use the 6 palette accents intentionally: muted / info / eng / conv / yellow / danger (each gets one tier) |

## Time estimate

~3-4 hours focused work: 3 page rewrites (~50 min each) + run QA + manual
smoke on a brand session for all 3 routes + diff notes + lock.json
backfill.

## Deploy class

**production-impacting** — `git push origin main` triggers Vercel auto-deploy
of brand-web. Web-only flow; no `Packages/Mobile/src/**` touched, so
`release.maestro_green = "n/a"` per Flow 9/10/11 pattern. Surface for
explicit go after `pnpm qa` 75/75 GREEN.
