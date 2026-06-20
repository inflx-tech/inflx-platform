# Impact Analysis — Campaign Command Center

> Terse verdict: mostly a FRONTEND re-wire of data that already exists, plus 3 small,
> additive backend sub-builds. Existing campaign workflows must stay green.

## Affected files (anticipated)
- web (primary): app/dashboard/campaigns/[id]/page.js (the Command Center shell),
  /reviews (fold content-review into the action card), /sets, /influencers, /escrow
  sub-views (consolidate). lib/api.js (reuse engagement/conversions calls; add clicks-rollup).
- backend (small, additive only):
  - new: a store-clicks rollup endpoint over link_clicks (per creator/set/campaign).
  - new: per-creator date window column + date-change request/approve endpoints + table.
  - new (optional): structured product allocation read (parse offer_config_json or a link view).
- mobile: none.

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| GET | /campaigns/:id | reuse (master-detail tree, tranche_statuses, deliverables) | Command Center |
| GET | /brands/me/campaigns/:id/engagement | reuse (totals/by_set/by_influencer) | Analytics |
| GET | /brands/me/campaigns/:id/conversions | reuse (totals/by_channel/by_influencer) | Analytics |
| POST | /deliverables/:id/review (+ confirm-live) | reuse | content-review action card |
| GET | /brands/me/campaigns/:id/clicks (NEW) | new rollup over link_clicks | per-creator clicks tile |
| POST | /campaign-influencers/:id/date-change (NEW) | new request/approve flow | date-change action card |

## Affected workflows (regression surface)
- Existing campaign detail + reviews + escrow flows — covered by qa/web/brand/* and the
  campaign engagement/conversions specs. Must stay green; this reorganizes their presentation.

## Migration / deploy / OTA impact
- Frontend re-wire: push only (web). 
- New backend bits: date-change needs a migration (new column + requests table); clicks
  rollup + products read are query-only (no migration). No OTA (no mobile).

## Risk notes
- No destructive ops. Reach/impressions deliberately excluded (phantom). Date-change is the
  only state-machine addition — gate it so an approved change shifts ONLY that creator's window.
- Recommend phasing (see lock notes): Phase 1 re-wire existing data (zero new backend),
  Phase 2 clicks rollup + structured products, Phase 3 per-creator dates + date-change flow.
