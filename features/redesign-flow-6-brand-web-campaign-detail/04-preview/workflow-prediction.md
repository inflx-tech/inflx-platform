# Workflow prediction — Flow 6

`mockups/web.html` shows hub view + Influencers sub-route example. Sets and Reviews follow the same pattern (filter bar + cards).

| Mockup section | Real source | Implementation note |
|---|---|---|
| Hub summary card | `page.js` (restructured) | yellow-pale gradient + corner accent + progress + 4 KPIs |
| Hub drill-down tile grid | `page.js` | 6 tiles in 3-col grid, each navigates to its sub-route |
| Hub inline Analytics | `page.js` | 4-tile mono grid; full view → existing `/dashboard/conversions` |
| Hub sticky right rail | `page.js` | Needs Attention queue, each row navigates to relevant sub-route |
| Influencers list | `/influencers/page.js` NEW | search + Set/Status chips + 2-col card grid + inline modals |
| Sets list | `/sets/page.js` NEW | set cards + mini-roster + funnel for open_group |
| Reviews list | `/reviews/page.js` NEW | 2-tab queue with MediaPreview + DeliverableStats |
| Escrow | `/escrow/page.js` (existing) | restyle in-place to locked palette only |
