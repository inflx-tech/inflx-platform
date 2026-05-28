# Flow 37 — Expected outputs

## ContractScreen — per-state assertions

| State | Expected render |
|---|---|
| Loading | Yellow ActivityIndicator + "Loading contract…" |
| No contract | "Contract not found" + Go Back |
| draft | yellowPale draft banner + Campaign Details + Deliverables (formats_json) + Goal-aware fee/commission + clauses highlight + signatures + NO sign CTA, NO PDF button |
| pending_influencer | All cards + View PDF (if pdf_url) + Sign Contract card with ink/yellow CTA |
| Sign Modal open | bottom-sheet w/ name input + ghost Cancel + ink/yellow Sign Now |
| pending_brand | "Contract signed successfully" successPale banner + production panel |
| active | successPale active banner + full production panel |
| InfluencerProductionPanel — remote | bg2 box "💻 Remote production" |
| Panel — visit no-location | "Brand will send location" note |
| Panel — visit picker | DateTimeChipPicker + notes input + "Send my slot" ink/yellow CTA + "Can't visit? Switch to remote" link |
| Panel — brand proposed slot | Slot card + Accept + Counter (with picker) + Switch-to-remote |
| Panel — flip banner | yellowPale banner if brand-initiated flip |
| Panel — visit confirmed | success slot card + "Mark visit complete" CTA |
| Panel — shipment proposed | Address detail + Confirm + "Use different address" |
| Panel — shipment in_progress | Courier + tracking + "Package received" CTA |

## DateTimeChipPicker — assertions

| Element | Expected |
|---|---|
| Date strip | Horizontal scroll, ink-active chip + yellow text |
| Hour grid | 12 chips (8 AM – 7 PM), ink-active + yellow text |
| Minute chips | 4 chips (:00 / :15 / :30 / :45), ink-active + yellow text |
| Summary | successPale + successText datetime display |

## Data assertions

- `fee = parseFloat(contract.influencer_fee || contract.agreed_fee) + parseFloat(contract.bonus_amount)`
- `showTranches = fee > 0 && !isConversion`
- `showCommissionCard = commission_pct > 0 || isConversion`
- Tranches: T1=25% / T2=25% / T3=50% of total fee
- Avatar initials from `instagram_handle`
- `(custom_clauses.clauses[k].enabled ? show)` logic for highlight
- `Math.round` on tranche amounts (matches existing rounding)
