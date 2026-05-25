# Expected Outputs — Flow 23

## StatusPill canonical map extension (NEW — 5 entries)
| Status | Bg / Fg | Label |
|---|---|---|
| `awaiting_brand` | yellowPale / yellowText | YOUR TURN |
| `awaiting_influencer` | infoPale / info | WAITING |
| `agreed` | successPale / successText | AGREED |
| `walked_away` | bg2 / muted2 | CLOSED |
| `open` | yellowPale / yellowText | OPEN |

Total `STATUS_MAP_DEFAULT` entries now: 31 (Flow 21 seeded 19 + Flow 22 +7 + Flow 23 +5).

## ActionRequired per-tab outputs

| Tab | Card output |
|---|---|
| Applications | Card: @handle + tierTag (yellowPale + yellowText capitalize), influencer/campaign meta, followers + ER + city, niche line, View-profile link (yellowText), Reject (dangerPale) + Approve (ink+yellow mono) row |
| Negotiations | Card: @handle + StatusPill "YOUR TURN" (yellowPale), campaign/set meta, last counter fmtRupees mono, "Tap to respond →" yellowText hint |
| Content | Card: @handle + StatusPill (from item.status), type label + campaign, submitted-date mono, revision count, "Tap to review →" hint |
| Contracts (signatures) | Card with checkbox left + name/campaign/fee+bonus meta + lock-amount mono right; ink border + yellow50 bg when selected; "Review terms →" link |
| Failures | Card: @handle + failureTag (dangerPale + dangerText "CONTRACT/PDF"), campaign meta, mono red error msg (3-line clamp), occurred date, "Retry contract create" / "Regenerate PDF" button (ink + yellow mono) |

## Bulk-sign bar (signatures tab)
- Visible only when contracts.length > 0
- yellow50 bg strip, dangerPale-border-bottom
- Left: ink-bordered checkbox + bulk label ("Select all (N)" or "N selected · ₹X,XXX total lock")
- Right: ink/yellow-mono "Sign (N)" button, disabled when selection empty or signing

## Negotiation outputs

| Element | Output |
|---|---|
| Header status pill | StatusPill(status) — awaiting_brand → "YOUR TURN", awaiting_influencer → "WAITING", agreed → "AGREED", walked_away → "CLOSED", open → "OPEN" |
| Summary boxes | Original = bg2 + ink mono digits; Latest = yellowPale + yellowText mono digits |
| Turn bubble (brand) | yellow50 bg + yellowPale border + yellowText author label, margin-left:35 |
| Turn bubble (influencer) | white bg + border + ink2 author label, margin-right:35 |
| Action: Accept | success-green bg, white text, Outfit-Bold |
| Action: Walk Away | dangerPale bg, dangerText, sans-Bold |
| Action: Send Counter | ink bg, yellow text, JetBrains-Mono "SEND COUNTER OFFER" |
| Waiting panel | yellowPale strip + yellowText copy |
| Closed panel (agreed) | bg2 + muted copy "Agreed on ₹X. Contract is being generated." |
| Closed panel (walked_away) | bg2 + muted copy "This negotiation was closed without an agreement." |

## Data assertions
- bulkSignContracts: response `signed_count` flows into success Alert
- approveApplication: response `slots_filled` + `closed_out_count` flows into success Alert
- submitNegotiationTurn (counter): triggers reload + scroll-to-end after 300ms
- submitNegotiationTurn (accept | walkaway): triggers Alert with goBack on OK
- lockAmount: `(influencer_fee + bonus_amount) * (1 + platform_fee_pct/100)` rounded to 2 decimals; bulk total sums per-row

## Visual evidence
`design/wave2/flow-23-brand-mobile-action-negotiation/web.html` — 2 phones + StatusPill 5-NEW legend
