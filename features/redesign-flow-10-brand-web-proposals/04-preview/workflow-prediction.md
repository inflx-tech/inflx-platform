# Workflow prediction — Flow 10

`mockups/web.html` shows the proposals inbox in 4 states:
1. Normal — 5 proposals across mixed statuses + settings collapsed + accepting=true
2. Settings panel open — full filter form
3. Detail modal — proposal view with action footer
4. Empty state — no proposals (with conditional "Turn on proposals" CTA when accepts=false)

| Mockup section | Real source | Implementation note |
|---|---|---|
| Header count chip | `proposals.length` from `proposalApi.list(tab)` | Outfit H1 + yellow rule + ink count chip + ghost Settings |
| Settings panel (toggle) | `proposalApi.getSettings()` + `proposalApi.updateSettings()` | Locked-palette switch + chip selectors + ink Save button |
| Warning banner | `settings.accepts_proposals === false` | Yellow-pale card + Open-settings CTA |
| Status tab counts | client-side count over already-loaded `proposals[]` array | NEW — no extra API call |
| Row card · @handle + tier | `c.influencer_handle` + tier from `c.followers_count` | Same tier thresholds as OLD |
| Row card · niche chips (NEW) | `c.influencer_niches` (already in SELECT) | Up to 3 visible + "+N" overflow chip |
| Row card · pitch | `c.pitch_title` + `c.pitch_message` | Outfit semibold + muted preview line truncated |
| Row card · ask | `c.proposed_fee` + `c.proposed_commission_pct` | Mono right-aligned |
| Row card · status pill + sent | `c.status` + `c.created_at` | Locked-palette tones replace wave1 |
| Detail modal · stats | `c.followers_count` + `c.engagement_rate` + tier | 3 mono tiles |
| Detail modal · terms | `c.goal` + `c.proposed_fee` + `c.proposed_commission_pct` + `c.proposed_deliverables` + posting window | Same k/v rows as OLD |
| Detail modal · actions | `proposalApi.{accept, reject, counter}` per status gating | Identical handlers; restyled buttons |
| Empty state | `proposals.length === 0` | Conditional CTA when `settings.accepts_proposals === false` |
