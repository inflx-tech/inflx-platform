# Impact

**One line:** a briefed creator now lands on a contract that shows what she can sell, what her
shoppers get and what happens to her content — and can sign or refuse it on the spot.

## Production-impacting

- **Render** — `backend/src/**`. Migration 163 already applied.
- **OTA (influencer)** — the sign screen, the collab screen, the shared sheet.
- **OTA (brand)** — none. No brand-facing file changed.

## Behaviour that changes for people already using it

| Who | Before | After |
|---|---|---|
| Briefed on a clean agreement | lands in Invitations, opens a blank page | lands in To sign, opens her contract |
| Briefed on a **drifted** agreement | as before | **unchanged** — she re-agrees first |
| A creator who wants to say no | a button that returned 422 every time | works, and she can say why |
| Any creator opening a contract | fee, deliverables, dates | + what she can sell, her offer and its window, her content rights |

## Rows already in production

`campaign_influencers` rows already sitting at `invited` are **untouched**. They keep the old
path; only new briefs take the new one. Nothing is migrated, nothing is rewritten.

## Risk

- `accepted` is not a new status — it is what accepting a brief has always written. Nothing
  downstream sees a value it has not seen before.
- `LEFT JOIN brand_offers` — a creator with no library offer returns nulls and the card hides.
  Asserted.
- The decline DELETE is guarded to unsigned contracts. A signed contract is never deleted.

## Carried, not fixed

`cancelInfluencer` still writes `status = 'cancelled'` to `contract_status`, which has no such
value. Confirmed live. Out of scope here.
