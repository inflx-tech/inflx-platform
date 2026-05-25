# Flow 17 · workflow-prediction

| Element | Backend |
|---|---|
| Count chip | derived: sum(inf.tranches.length) across influencer_breakdown |
| Hero Total | summary.total |
| Hero Locked | summary.total_locked |
| Hero Released | summary.total_released |
| Hero Queued | summary.total_queued |
| Inf header @handle | influencer.instagram_handle |
| Inf header fullname | influencer.influencer_name |
| Inf header tranche count | influencer.tranches.length |
| Tranche icon/pill | tranche.status ('queued' / 'locked' / 'released') |
| Tranche number | tranche.tranche_number |
| Tranche trigger_event | tranche.trigger_event (snake_case → space-separated) |
| Tranche released_at | tranche.released_at (when present) |
| Tranche amount | tranche.amount → fmtMoney |
| Conversion notice | campaign.has_tranches === false |
| Empty state | !data?.entries || data.entries.length === 0 |
| Campaign name | campaign.name |
