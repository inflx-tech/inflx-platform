# Expected Outputs — Flow 20

## Canonical status-pill map (NEW — unifies 11 disparate palettes across 3 screens)

| Status (enq/prop/etc) | Palette | brandPalette token |
|---|---|---|
| `submitted`, `new`, `sent` | yellow pale + yellow text | `yellowPale` / `yellowText` |
| `contacted`, `viewed`, `responded` | info pale + info | `infoPale` / `info` |
| `countered` | conv pale + conv | `convPale` / `conv` |
| `converted`, `accepted` | success pale + success text | `successPale` / `successText` |
| `rejected`, `declined` | danger pale + danger text | `dangerPale` / `dangerText` |
| `closed`, `expired`, `withdrawn` | bg2 + muted2 | `bg2` / `muted2` |

## Per-step observable outputs

| Path | Step | Output |
|---|---|---|
| A | 1 | Ink topbar "Enquiries" Outfit 22 + subtitle PJS muted + yellow rule. Filter strip below with chips (active = ink bg / yellow text mono; inactive = bg2 + muted) |
| A | 4 | Modal sheet rounded-top with backdrop. InfoRow grid with mono labels + ink values. Convert-box on success-pale bg + green rupee input. Close button is small danger-text link at bottom |
| A | 5-7 | Optimistic mark flips card status pill colour immediately; Alert confirms |
| B | 1 | Ink header centred + back-pill. Banner is yellowPale strip with yellow-text + ink "Turn on" pill. Accepted-bar is successPale strip with green "Pause" link |
| B | 2 | Tab strip on white surface; active = ink underline + ink text; inactive = muted |
| B | 4 | Modal sheet; 3-stat row in bg2 tiles with mono digits; sections labels = mono uppercase muted; rows = label muted + value ink right |
| B | 5 | 3 action buttons in row: Decline (bg2 muted), Counter (convPale conv text), Accept (yellow ink text) |
| B | 6-8 | Form fields in formBox bg2; inputs white with border; submit button matches the mode (counter = convPale conv text, reject = dangerPale danger text, accept = yellow ink) |
| C | 3 | Full ink hero (top-to-stats-grid) with 80px yellow avatar + Outfit white handle + PJS translucent full name + mono meta |
| C | 4 | Stats grid: 3x2 tiles white card + mono uppercase labels + Outfit ink value digits |
| C | 4 cards | "About" card title Outfit muted uppercase; bio PJS ink. Chips: niche = yellowPale + yellowText, lang = engPale + eng |
| C | 5 | Sticky footer: yellow "Invite to Campaign" CTA with ink text, ink "Cancel" alternative if any |
| C | 6-8 | 3-step invite modal with breadcrumb back; step 3 confirmCard on yellow50 bg; goal-aware form fields appear/hide based on `setGoal` |

## Data assertions

- Enquiries: `updateEnquiry(id, payload)` produces correct status transitions; `deal_value` stored in rupees
- Proposals: `acceptProposal` / `rejectProposal` / `counterProposal` produce correct state transitions
- InfluencerProfile: `inviteInfluencer(cId, sId, payload)` creates campaign_influencer row with `status: 'invited'`
- Money math: `fmtMoney` / `fmtRupees` consume rupee-denominated fields per migration 021

## Visual evidence

- Mockup at `design/wave2/flow-20-brand-mobile-modal-form/web.html` — 3 main screens + modal thumbnails

## Acceptance

Founder smoke-test post-OTA:
1. Enquiries — filter chips swap palette, modal opens with new look, convert flow works
2. Proposals — banner shows yellow-pale state, accept/decline/counter still work
3. InfluencerProfile — yellow avatar in ink hero, niche chips yellow / lang chips teal, invite modal 3-step still works end-to-end
