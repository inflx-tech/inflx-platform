# Flow 44 — Follower ENQUIRY + RETURNS → light brandPalette (F3 tail)

## Goal
Restyle the two remaining F3 follower surfaces — `EnquiryScreen` and
`MyReturnsScreen` — from their legacy/dark visual systems onto the F0-locked
light `brandPalette`. **Visual + UX only. Zero functional change.** This closes
Phase F3 (shared CTA / account surfaces) before F4 (restaurant vertical).

## Screens in scope (2)
1. **EnquiryScreen.js** (233 LOC, legacy `colors` navy) — lead-capture form:
   name / phone / email / message / preferred-date → `submitEnquiry`. Pre-fills
   name+phone from AsyncStorage `inflx_user`. Required-field + phone validation.
   Success state (teal-pale circle + teal check today).
2. **MyReturnsScreen.js** (168 LOC, `darkColors` + hardcoded hexes) — return
   history list via `listMyReturns` (`GET /follower/returns`). Each row: thumb +
   product/brand/date + status pill + reason + refund amount + admin notes.
   Pull-to-refresh + focus reload. Empty state. Inline `STATUS_THEME` map for the
   5 return states (requested / approved / received / refunded / rejected).

## Design language (locked F0 / Flow 38)
- Light `brandPalette` (`P`): white / yellow `#FFC107` / ink, Outfit + Plus Jakarta
  Sans + JetBrains Mono.
- ink hero header · yellowPale offer strip (Enquiry) · white form/list cards ·
  mono labels + amounts · ink/yellow Outfit-Black CTA · yellow check-tile success.
- **Status pills → brandPalette pales** (pale bg + dark text): Awaiting review →
  yellowPale/yellowText · Approved/Refunded → successPale/successText · Goods
  received → infoPale/info · Declined → dangerPale/dangerText. Kept as the
  screen's own return-status map (NOT the canonical 43-StatusPill — that is the F4
  decision per FOLLOWER_REDESIGN_PLAN §7.3 / Flow 43 §9).

## Non-negotiable (preserve verbatim — see 05-impact.md)
`submitEnquiry` payload + 4-ID tracking (cid/sid/iid + oid in form_data) ·
name/phone pre-fill · required-field + phone validation · `listMyReturns` fetch +
refund math (`fmtRupees`) + status mapping · pull-to-refresh + focus reload ·
empty + success render branches.

## Mockup
`design/wave3/flow-44-follower-enquiry-returns/web.html` (mirrored to
`04-preview/mockups/web.html`). Founder green-signaled via AskUserQuestion
2026-05-28 ("Green — implement") BEFORE implementation.
