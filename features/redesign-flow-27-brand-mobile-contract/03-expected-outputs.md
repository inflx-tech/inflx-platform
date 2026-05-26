# Flow 27 — Expected outputs (per state)

## Visual evidence (matches locked mockup)

### Frame 1 — Draft editor (contract.status = 'draft', isEditing=true)
- Ink topbar with 30×3 yellow rule, "‹ Back" link (mono), title "Contract" (Outfit-Bold 20), sub "Riya Sharma · Diwali campaign" (PJS-Medium 11 muted-white), right-side `<StatusPill status="draft" />` (canonical 'DRAFT' label, bg2 / muted2).
- Yellow-pale draft banner "Draft Contract — Your Review".
- Terms card: Base Fee / Posting Date / Revision Limit (mono values). When bonus > 0: success-pale bonus row + ink-strong total row.
- Content Requirements card with "Restore default" mono link (dashed-underline) and tall textarea-look card.
- Optional Clauses card: 3 clause rows, ✓ checkbox tile when on (success bg), option chips below (ink chip when active). Bonus input row with ink border (danger border on shortage). Wallet breakdown box (bg2 normal, dangerPale on shortage). Mode picker: 3 `[VISIT]`/`[SHIP]`/`[REMOTE]` mono-bracket tiles.
- Deliverables count card with mono key-value rows.
- Signatures card with 2 sig-boxes (bg2 unsigned, successPale signed).
- Ink CTA "APPROVE & SEND TO INFLUENCER" (Outfit-Black, yellow text).
- White outlined "VIEW CONTRACT PDF" button (ink border).

### Frame 2 — Active + visit proposed slot
- Topbar pill = canonical 'ACTIVE' (successPale).
- Active confirmation banner (successPale).
- Production panel (yellow-50 bg): mono-bracket `[VISIT]` ico in title, right pill = 'PROPOSED' (yellowPale).
- Slot card (white, success border): mono date "Mon 5 Nov · 11:00 AM", meta line.
- Yellow CTA "ACCEPT SLOT" + ghost "Suggest Another Time" + underlined link "Skip the visit — switch to remote".

### Frame 3 — Active + shipment confirmed
- Topbar pill = 'ACTIVE'.
- Production panel: mono `[SHIP]` ico in title, right pill = 'CONFIRMED' (successPale).
- Address display card.
- Courier + AWB form (ink-on-white inputs, mono font).
- Ink CTA "MARK AS DISPATCHED".
- History log footer with reversed last 5 entries.

### Frame 4 — Pending Brand (counter-sign) + production setup picker
- Topbar pill = 'YOUR TURN' (yellowPale, canonical).
- Terms card with Commission row (12% per conversion) — NO Base Fee row because goal='conversion'.
- 1 read-only clause shown.
- Signatures: influencer signed (successPale), brand pending (bg2).
- Ink CTA "COUNTER-SIGN CONTRACT".
- Setup-production card (yellow-50 bg) — 3 mode-picker cards (escape hatch for legacy/auto-fail).

### Side panel variants (mockup right column)
- All 4 contract status pills (draft / awaiting / your-turn / active).
- All 5 production event pills (proposed / confirmed / in-progress / completed / cancelled).
- Mode-picker active state.
- Signature box before/after.
- Wallet shortage (danger breakdown + disabled CTA).
- Remote-flip pending banner.

## Data assertions (no change)
- `brandApi.getContract` returns `{ contract, deliverables, suggested_content_requirements }`. Editor hydrates exactly these fields.
- `brandApi.approveContract` payload exactly: `{ custom_clauses: { clauses, notes }, bonus_amount, content_requirements, production_mode }`.
- `brandApi.brandSign` payload: `{}` (contract.id in URL).
- All 9 production-panel endpoints invoked with identical signatures.

## Behavioural assertions (preserved)
- `pnpm qa` 76+ passed gate 0 STATE=GREEN on first run after dual-probe pre-warm.
- Tap "Approve & Send" with wallet < lockNeeded → button shows "Top up wallet to send" + disabled state. Backend re-enforces if somehow tapped.
- Tap "Counter-sign Contract" → Alert with goal-specific copy (conversion vs engagement/hybrid) → on confirm, `brandSign(contract.id)` → Alert "Signed!" → `navigation.goBack()`.
- Production panel: visit-flow state transitions match prior wave-1 behaviour byte-for-byte.
- `keyboardShouldPersistTaps="always"` retained — taps on inputs do not dismiss the Android keyboard.

## Regression watch
- All 4 main-screen states render without prop drilling errors.
- All 6 visit sub-states render with correct conditionals.
- All 4 shipment sub-states render with correct conditionals.
- Wallet math identical in both call sites (button-disabled check + breakdown card).
- Defensive JSON parse for `custom_clauses` still handles string-pickled shape.
