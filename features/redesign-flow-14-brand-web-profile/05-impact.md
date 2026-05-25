# Flow 14 · impact

**Terse verdict (chat):** zero functional / backend / logic / DB impact —
visual + UX only. Single-page restyle.

---

## Files touched

| File | Action | LOC delta |
|---|---|---:|
| `Packages/brand-web/app/dashboard/settings/profile/page.js` | full rewrite | ~603 → ~720 |
| `design/wave2/flow-14-brand-web-profile/web.html` | new mockup | +661 |
| `features/redesign-flow-14-brand-web-profile/01-spec.md` | new | +130 |
| `features/redesign-flow-14-brand-web-profile/02-workflow.md` | new | +110 |
| `features/redesign-flow-14-brand-web-profile/03-expected-outputs.md` | new | +90 |
| `features/redesign-flow-14-brand-web-profile/04-preview/mockups/web.html` | new (mirror) | +661 |
| `features/redesign-flow-14-brand-web-profile/04-preview/workflow-prediction.md` | new | +90 |
| `features/redesign-flow-14-brand-web-profile/05-impact.md` | this file | +90 |
| `features/redesign-flow-14-brand-web-profile/06-diff/notes.md` | new (post-impl) | +80 |
| `features/redesign-flow-14-brand-web-profile/lock.json` | new | +35 |

## NO-TOUCH preserved

- `backend/**` — zero changes
- `backend/migrations/**` — zero changes
- `Packages/shared/**` — zero changes
- `Packages/Mobile/**` — zero changes
- `Packages/brand-web/lib/api.js` — zero changes (`brandApi.getMe`, `brandApi.updateMe` consumed as-is)
- `Packages/brand-web/app/dashboard/layout.js` — zero changes
- `Packages/brand-web/app/dashboard/settings/layout.js` — **PRESERVED** (Window A's Phase A9 hub shell with H1 + tabs; already palette-aligned with ink/bg/border colors)
- `Packages/brand-web/app/dashboard/settings/subscription/page.js` — zero changes (Window A's Phase A7-brand)
- `Packages/brand-web/app/dashboard/settings/billing/page.js` — zero changes (Window A's Phase A7-brand)
- `Packages/brand-web/app/dashboard/profile/page.js` — **PRESERVED** (the 6-LOC server redirect to settings/profile)
- All API call shapes (request body, response field names) frozen
- `PATCH /brands/me` payload keys: `business_name?`, `gstin?`, `logo_url?`, `address_line?`, `pincode?`, `listing_data?` — frozen
- `listing_data.branches[0].name === 'Main Branch'` literal preserved (backend identifies Primary by this string)
- localStorage / cookies — untouched
- Role gate — unchanged (handled by Settings hub layout)

## What changes (UX + visual)

- Multi-card layout using undefined Tailwind tokens (`bg-gold`, `text-t1`, `border-border2`, `bg-surface2`, `bg-red`, `bg-teal-100`, `bg-yellow-100`) → locked palette CSS vars under `.prf`
- Gradient-red Save button → ink+yellow Save Changes
- Status banner colors: amber/red/teal Tailwind → palette pills (`yellow-pale`/`danger-pale`/`success-pale`)
- Yellow-100/red-100/teal-100/gray-200 status backgrounds → palette tints
- Inline SVG lock icons → 🔒 unicode emoji in `field-l` label
- Tooltip on "Upload File" → palette ink hover
- Generic spinner skeleton → locked-palette yellow spinner (consistent with Flows 11-13)
- Redundant `<h1>Profile & Settings</h1>` removed (layout already renders "Settings")
- Toast restyled to ink (success) / danger (error) bottom-right (matches Flows 11-13)
- Main Branch sub-card: gray border → success-pale tint (top gradient) to visually distinguish from additional branches
- "+ Add Branch" button: yellow-text underlined gold → yellow-ghost button (subtler, doesn't compete with main Save)
- Account Details: 2-cell gray grid → 4-cell mono grid (NEW: Brand ID + Status dot)
- "Remove" branch: red Tailwind link → danger-text text link with palette hover
- All numbers/phone/pincode/GSTIN/dates/Brand ID in JetBrains Mono

## NEW intel surfaced (small additions, all already-loaded)

- Brand ID (truncated to first 12 chars + ellipsis) in Account Details card
- Status indicator dot (●) in Account Details (replaces banner-only display for approved brands)

## Adjacent-fixes shipped

- OLD page referenced undefined custom Tailwind tokens (`bg-gold`, `text-t1`, `text-t2`, `text-t3`, `bg-surface2`, `border-border2`, `border-border`, `bg-red`, `bg-teal-100`, `bg-yellow-100`, `bg-red-100`, `bg-gray-200`) — replaced with locked palette CSS vars
- Inline SVG lock icons (path drawings) → unicode 🔒 emoji in clean label tag
- Redundant H1 removed
- Status banner restyled to palette pills (was using arbitrary Tailwind tints)

## Risks · mitigations

| Risk | Mitigation |
|---|---|
| CSS cascade collisions with Settings hub layout's `.shub` rules | All Flow 14 rules scoped under `.prf` — no overlap with `.shub`. Specificity 0,2,0 wins over global Tailwind utilities if any. |
| Brand fills branch fields then save fails — state not lost | Preserved: state stays on submit failure; brand can retry without re-entering |
| Brand updates contact person but no other listing_data change | Preserved: JSON.stringify compare detects the change; full listing_data sent |
| Brand removes a branch then saves — list correctly updates | Preserved: branches array filter + payload diff includes listing_data |
| Logo thumb shows broken-image icon | onError handler hides img + reveals "No logo" fallback (preserved from OLD pattern; restyled) |
| Settings tab clicks (subscription / billing) navigate away mid-edit | OLD UI doesn't warn on unsaved changes; same behavior preserved (no unsaved-changes guard added) |

## Time estimate

~75 min focused work: page rewrite (~50 min) + QA + manual smoke + diff notes + lock.json backfill.

## Deploy class

**production-impacting** — `git push origin main` triggers Vercel auto-deploy of brand-web. Web-only flow; no `Packages/Mobile/src/**` touched, so `release.maestro_green = "n/a"` per Flows 9/10/11/12/13 pattern. Surface for explicit go after `pnpm qa` 75/75 GREEN.
