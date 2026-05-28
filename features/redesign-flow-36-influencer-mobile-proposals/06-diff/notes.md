# Flow 36 — Before/After diff notes

## Before (legacy palette/fonts)

| Screen | Visual |
|---|---|
| ProposalsHubScreen | White topbar with `‹` text back · navy tab-active underline · ad-hoc STATUS_PILL (7 custom hex variants: #FFF4D6/#DBE5FF/#EEEDFE/#E0FAF5/#FDEEE9/#F2F4F9) · surface2 brand logo with navy initials · navy primary CTA on counter Accept · red withdraw link · 🔍📨 empty emoji |
| SendProposalScreen | White topbar with `‹` text back · surface2 criteria card with t3 title · surface2/border2 inputs · navy goal-chip-active · surface2 counter btns +/− · navy SUBMIT BTN |

## After (brandPalette + Outfit/PJS/Mono + StatusPill canonical)

| Screen | Visual |
|---|---|
| ProposalsHubScreen | White topbar with bg2 MCI chevron-left back-btn + centered Outfit-Bold title · yellow-underline active tab + Outfit-Black UPPERCASE labels · **yellow brand-logo tile with ink Outfit-Black initials** (matches Flow 32 MyStore + Flow 35 Profile) · **StatusPill canonical** for 6 statuses (viewed/countered/accepted/rejected/expired/withdrawn) + **inline yellowPale 'SENT' pill** for sender-POV outbound · dangerPale reject reason box + Outfit-Black danger title · convPale counter offer box + Outfit-Black title + **ink/yellow Outfit-Black ACCEPT COUNTER + ghost-ink DECLINE** · dashed dangerText WITHDRAW link · yellowPale dashed empty tile |
| SendProposalScreen | White topbar with bg2 MCI back-btn + Outfit-Bold title + mono UPPERCASE brand sub · **yellowPale criteria card** with Outfit-Black "WHAT THIS BRAND WANTS" + sans body · mono UPPERCASE field labels · **ink-bordered inputs** (matches Flow 33-35 pattern) · **ink-active goal chips** with yellow text · 5 deliverable rows w/ Outfit-Bold format label + bg2 -/+ btns + mono number · 2-date posting-window input row · 3 URL portfolio inputs · **ink/yellow Outfit-Black SEND PROPOSAL CTA** · KeyboardAvoidingView preserved |

## Per locked design call (standing autonomy)

| # | Decision | Implementation |
|---|---|---|
| 1 | Tab pattern = yellow-underline active + Outfit-Black UPPERCASE | `tab.borderBottomColor = P.yellow` (active) · `tabLabel.color = P.ink` (active) |
| 2 | Brand logo tile = yellow + ink Outfit-Black initials | `brandLogo.backgroundColor = P.yellow` · text color P.ink |
| 3 | 'Sent' status = inline yellowPale 'SENT' (sender-POV) | inline pill render at `proposal.status === 'sent'`; StatusPill canonical for other 6 statuses |
| 4 | Counter Accept CTA = ink/yellow Outfit-Black + ghost-ink Decline | `counterBtnPri.backgroundColor = P.ink` · text color P.yellow · `counterBtnAlt.backgroundColor = P.white` · border P.ink |

## Render-branch preservation evidence

| Screen | Branches preserved |
|---|---|
| ProposalsHubScreen | 2-tab state machine / debounced search (300ms) / brand logo image OR initials fallback / 7 status pill variants / canWithdraw conditional / withdraw 2-confirm Alert / respondCounter accept/decline / reject reason box / counter offer box with terms / empty state |
| SendProposalScreen | criteria loading / criteria filters present (5 variants) / criteria no filters / 3 goal chip state machine / goal-conditional fee field / goal-conditional commission field / 5-format counter rows with +/- adjust / posting window optional / 3 portfolio link inputs / submit validation (title+pitch / 1+ deliverable / fee required if not conversion) / KeyboardAvoidingView |

**Total preserved**: ~18 render branches.

## API preservation evidence

```js
influencerApi.discoverBrands(search.trim() || null)
influencerApi.listMyProposals()
influencerApi.withdrawProposal(p.id)
influencerApi.respondCounter(p.id, action)  // action='accept'|'decline'
influencerApi.getBrandProposalCriteria(brandId)
influencerApi.createProposal({
  brand_id, pitch_title, pitch_message, goal,
  proposed_fee, proposed_commission_pct,
  proposed_deliverables, proposed_posting_window_start, proposed_posting_window_end,
  portfolio_links,
})
```

All preserved verbatim.

## Sign-off

- Mockup locked 2026-05-27 (founder · "Go with flow 36" — standing autonomy on 4 design calls)
- Implementation locked 2026-05-27
- Web QA + OTA: see lock.json
