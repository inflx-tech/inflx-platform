# 03 · Expected outputs — Flow 10

## Page chrome

- Inside dashboard `/layout.js` chrome (left sidebar + topbar)
- Outfit display, Plus Jakarta body, JetBrains Mono on every ₹ / @handle / date / followers / ER
- Locked palette throughout (white surfaces + #FAFAFA bg + #0A0A0A ink + #FFC107 yellow accents)
- Single column max-w-6xl

## Header
- Crumb: `/dashboard · proposals`
- Outfit H1 "Influencer Proposals" + yellow rule + mono count chip ("12 pending")
- Subtitle: "Pitches sent to you by influencers. Toggle settings to control who can pitch you."
- Ghost "Settings" button (right)

## Settings panel (collapsible)
- White card with Outfit H3 "Proposal settings"
- Switch row: "Accept proposals from influencers" (yellow accent checkbox)
- When enabled:
  - Min tier chip selector (Any · Nano · Micro · Macro · Mega) — ink active state
  - Allowed niches chip selector (Food · Fashion · Fitness · Travel · Lifestyle · Beauty · Tech · Gaming · Finance · Parenting)
  - Min engagement % number input (mono)
  - "City match required" checkbox (yellow accent)
  - "Only influencers I've worked with before" checkbox
- Footer: ink "Save settings" button (yellow text)

## Warning banner (when `accepts_proposals=false`)
- Yellow-pale card with `!` icon
- "You're not accepting proposals yet. Influencers can't pitch you until you turn this on."
- "Open settings →" CTA (yellow-text link)

## Status tabs
- Locked palette · ink active state with yellow underline
- **Mono per-tab counts** (NEW) derived from already-loaded array:
  - All (N) · New (N) · Viewed (N) · Countered (N) · Accepted (N) · Rejected (N)
- Horizontal scroll under 720px

## Proposal row cards
Replaces the OLD table. Per row (white card, click-through):
- Avatar (2-letter handle initials, yellow-pale bg + ink text)
- Top line: name (Outfit bold) + `@handle` (mono) + tier pill (Nano/Micro/Macro/Mega) + city
- **Niche chips (NEW from `influencer_niches`)** — small mono chips, up to 3 visible + "+N" overflow
- Pitch title (Outfit semibold)
- Pitch message preview (1 line, muted, truncated)
- Right side: mono ₹ ask + commission % + status pill + sent-date (mono)
- Hover: border darkens, slight bg shift

## Empty state
- Yellow-pale gradient card
- ✓ icon (or 📨 message glyph)
- "No proposals here" Outfit heading
- "When an influencer pitches you, it'll show up here." sub
- Conditional: if `accepts_proposals=false`, add "Turn on proposals in Settings →" CTA

## Detail modal
- Backdrop: black 50% opacity
- White rounded-2xl card, max-w-2xl
- Header: pitch title (Outfit) + influencer info + close (✕)
- Body:
  - 3 mono stat tiles: Followers · Engagement · Tier
  - "Pitch" section: full message (whitespace preserved)
  - "Proposed terms" section: goal / fee / commission / deliverables / posting window — k/v rows
  - "Portfolio samples" section: clickable links (yellow-text)
  - Status banner if rejected/accepted (red-pale / success-pale)
- Action footer (only when status is `sent` or `viewed`):
  - "Decline" (ghost button) · "Counter" (yellow button) · "Accept" (ink+yellow button)
- Reject mode panel: textarea + Cancel + danger-tone "Confirm reject" button
- Counter mode panel: counter fee + counter commission % + message textarea + Cancel + ink "Send counter" button

## CSS scoping discipline (mandatory per durable rule)

- All rules scoped under `.prp` wrapper (specificity 0,2,0)
- Every `:hover:not(:disabled)` re-asserts `color`
- Every `:disabled` locks both `background` + `color` (not just opacity)
- Pattern from Flow 7 patch + Flow 8 preventive + Flow 9 day-1 discipline

## QA gate

- `pnpm qa` = 71/71 PASSED · STATE=GREEN · gate 0
- No spec re-baseline (no spec asserts on /dashboard/proposals copy/layout)

## Governance gates

- Rule 1 (approved contract) ✓
- Rule 2 (release evidence at flip) ✓
- Rule 3 (mockup_locked) ✓
- Rule 4 (06-diff/notes.md) ✓
- Rule 5 (Maestro) does NOT fire (web only)

## Functional preservation

- All 8 endpoints preserved (no shape change)
- Settings JSON shape preserved
- Modal action gating preserved (only `sent`+`viewed` can act)
- Tab keys preserved
- Brand-approval gate inherited unchanged
- View-mark semantics preserved (still doesn't call `get(id)` on row click — matches OLD)
