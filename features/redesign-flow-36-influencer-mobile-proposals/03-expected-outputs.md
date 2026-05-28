# Flow 36 — Expected outputs

## Per-screen rendered output assertions

### ProposalsHubScreen
| State | Expected render |
|---|---|
| Discover tab loading | Yellow ActivityIndicator |
| Discover tab loaded | Search + intro + brand cards w/ yellow logo tiles |
| Discover tab empty | yellowPale empty tile + 🔍 + helper |
| Search non-empty | Debounced filter on business_name |
| My Proposals loading | Yellow ActivityIndicator |
| My Proposals empty | yellowPale empty tile + 📨 + helper |
| Proposal — sent | inline yellowPale 'SENT' pill + withdraw link |
| Proposal — viewed | StatusPill canonical 'VIEWED' (infoPale) + withdraw link |
| Proposal — countered | StatusPill canonical 'COUNTERED' (convPale) + counter box + accept/decline + withdraw link |
| Proposal — accepted | StatusPill canonical 'ACCEPTED' (successPale) |
| Proposal — rejected | StatusPill canonical 'REJECTED' (dangerPale) + reject reason box |
| Proposal — expired | StatusPill canonical 'EXPIRED' (bg2/muted) |
| Proposal — withdrawn | StatusPill canonical 'WITHDRAWN' (bg2/muted) |

### SendProposalScreen
| State | Expected render |
|---|---|
| loadingCriteria | Yellow ActivityIndicator |
| criteria with filters | yellowPale criteria card with bullets |
| criteria no filters | "No specific criteria — open to anyone" |
| Goal=engagement | Fee field visible, commission hidden |
| Goal=conversion | Commission field visible, fee hidden |
| Goal=hybrid | Both fee + commission fields visible |
| Submitting | Yellow ActivityIndicator on CTA |
| Validation fail | Alert "Missing" |
| Submit success | Alert "Sent" → goBack() |

## Data assertions

- `discoverBrands(q)` returns `{ brands: [...] }`
- `listMyProposals()` returns `{ proposals: [...] }`
- `getBrandProposalCriteria(brandId)` returns `{ brand: { ..., proposal_filters: {...} } }`
- `createProposal({...})` returns `{ proposal }` on success
- `withdrawProposal(id)` and `respondCounter(id, action)` are fire-and-reload
- `proposed_deliverables` = `Object.entries(deliverables).map(([type, count]) => ({ type, count }))`
- `portfolio_links` = `[link1, link2, link3].map(s => s.trim()).filter(Boolean)`

## Backend assertions (no new endpoints)

All 6 APIs preserved verbatim.
