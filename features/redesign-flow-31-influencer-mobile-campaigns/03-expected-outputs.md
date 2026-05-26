# Flow 31 — Expected outputs

## Visual evidence (matches locked mockup)

### Frame 1 — MyCampaigns Active tab
- Ink topbar + 30×3 yellow rule + back chevron + "My Campaigns" title + sub line.
- 3 tab pills: ink-active "Active" + bg2-inactive "Completed" + "All".
- 3 campaign cards: brand name + campaign name + canonical pill (Active/Contracted/Accepted) + 3 mono stats (Fee / Goal / Deliverables count) + footer date range.
- Pull-to-refresh.

### Frame 2 — CampaignDetail (Active state, engagement)
- Header: ink + yellow rule + brand "Sparkle Cosmetics" + campaign "Diwali Glow-Up" + Active pill.
- Quick Actions card with 2 bg2 tiles (Contract + Earnings) — ink-bg/yellow icon MCI tiles.
- Campaign Progress: 5-step indicator with 4/5 yellow dots + connecting yellow lines + "Active" current step (larger ink-bordered yellow dot).
- Campaign Info card: Start/End mono dates + Type "Engagement" + new `published` pill for campaign_status (infoPale).
- Payment card: successPale Total Fee "₹17,000" with base "₹15,000" + bonus "₹2,000" breakdown.
- Tranche Progress: 3 tranche rows with success/yellow/ink dots — T1 released (green pill + date) / T2 next (pending pill) / T3 locked (locked pill, ink dot).
- yellowPale TDS note.
- Contract section: successPale "Contract active" banner + signature timeline + ghost-ink "View Contract Details" + ink/yellow "View Contract PDF".

### Frame 3 — CampaignDetail (Negotiating + hybrid)
- Header: ink + yellow rule + brand "SoundCo" + Negotiating pill.
- yellowPale+yellow-border publish-products CTA banner with "3 products to publish" + mono sub + ink chevron-right.
- Quick Actions: 4 tiles (Negotiation handshake / Publish 0/3 / Earnings / 12% Commission badge).
- Progress: 2/5 yellow with current="Accepted" ink-bordered.
- Contract section: convPale negotiation info box with handshake MCI + bold "Negotiation in Progress" + current turn + latest offer line + ink/yellow "View Negotiation" CTA.

### Side panel
- StatusPill +4 NEW entries table (published / revision_requested / locked / released).
- 8-state contract banner variants (draft / pending_inf / pending_brand / active).
- 6 Quick Actions tile MCI icon names listed.
- 3-API backend trace.
- 22+ preserved branches list.

## Data assertions (no change)

- `getMyCampaigns(filter)` returns `{ campaigns: [...] }` shape preserved.
- `getMyCampaignDetail(ciId)` returns the existing 40+ field shape.
- `getNegotiationByCampaignInfluencer(ciId)` returns `{ negotiation, turns }`.
- All nav targets preserved (CampaignDetail → Contract, ContractPdf, DeliverableList, CampaignProducts, Earnings, Negotiation, CampaignCompletion).

## Behavioural assertions (preserved)

- `pnpm qa` 76+ passed gate 0 STATE=GREEN first-run after dual-probe pre-warm.
- Tab switch on MyCampaigns reloads + shows loading state.
- useFocusEffect triggers reload on screen-focus.
- Card tap on completed campaign → CampaignCompletion; else CampaignDetail.
- 5-step progress indicator updates correctly per influencer_status.
- renderContractSection renders correct sub-banner per (influencer_status × contract.status).
- Render-error try/catch falls back to friendly error UI.

## Regression watch

- All 4 new StatusPill canonical entries render correctly + don't break existing 39 entries.
- 22+ CampaignDetail render branches function.
- Quick Actions tiles render conditionally per state.
- Tranche dot color logic uses new tokens (released=success, next=yellow, locked=ink).
- Fee fallback chain handles missing contract gracefully.
- Render-error wrap catches subcomponent failures.
- StatusPill total = 43 after this flow.
