# Flow 44 — Before / After diff notes

## What shipped
Two F3-tail follower screens restyled to the F0-locked light `brandPalette`.
**Visual + UX only — zero functional change.**

| Screen | Before | After |
|---|---|---|
| **EnquiryScreen** | legacy `colors` navy (navyDeep header, orangePale offer banner, orange submit, teal success) | ink hero · yellowPale offer strip with **ink/yellow %OFF badge** · white form card with mono uppercase labels (req = red *) · ink/yellow Submit · **yellow check-tile** success (Outfit-Black title, ink/yellow Done) |
| **MyReturnsScreen** | `darkColors` + hardcoded hexes (`#0D1D2E`/`#142438`, amber spinner) | ink hero · white return cards (bg2 thumb, Outfit name, mono date) · **brandPalette status pills** (pale bg + dark text) · mono refund in status colour · **yellowPale "From INFLX" notes box** · light empty state · ink pull-to-refresh tint |

## Matches the mockup
`design/wave3/flow-44-follower-enquiry-returns/web.html` (founder-green-signaled
2026-05-28). All 4 frames implemented as drawn: Enquiry form, Enquiry success
(yellow tile), My Returns list (pale status pills), My Returns empty.

## Status pills
The 5-state return map (`STATUS_THEME`) was recoloured to brandPalette pales, NOT
swapped to the canonical 43-entry StatusPill — that consolidation is deferred to F4
(per FOLLOWER_REDESIGN_PLAN §7.3). Mapping: Awaiting review → yellowPale/yellowText ·
Approved/Refunded → successPale/successText · Goods received → infoPale/info ·
Declined → dangerPale/dangerText.

## Honest divergences
- **Enquiry success**: teal-pale circle + teal "✓" → yellow check-tile + ink "✓"
  to match the locked F0 success pattern (Flow 42/43). Same render branch.
- **Enquiry offer badge**: the discount text became an ink/yellow badge (was plain
  orange text) — matches the creator-deal badge style used across F3.
- **Spinner / refresh tint**: amber → `P.ink` (matches FollowerWallet precedent;
  yellow is low-contrast on the light bg).

## After-evidence
**Emulator after-screenshots SKIPPED this round per founder** (AskUserQuestion
2026-05-28 — "Green — implement", skip path). Lead/returns screens are login +
data-gated. **After-evidence = founder physical APK smoke-test on live follower
v57.** Before-reference = the locked mockup HTML. Babel transform of both screens
passes (metro preset).

## Preserved verbatim (verified by post-restyle grep)
- Enquiry: `submitEnquiry({brand_id, campaign_id, set_id, campaign_influencer_id,
  form_data{... offer_id}})` + 4-ID tracking + `inflx_user` name/phone pre-fill +
  required-field/phone validation + form/success render branches.
- MyReturns: `listMyReturns()` + `fmtRupees(refund_amount)` + `STATUS_THEME`
  `return_status` mapping + pull-to-refresh + `useFocusEffect` reload + list/empty
  branches.
