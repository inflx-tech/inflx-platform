# Impact

**One line: the admin pages stop printing dashes over data you already collected.**

## Deploy class

**production-impacting** — `backend/src` on Render and brand-web on Vercel. **No migration.**
No mobile change, so no OTA.

## Blast radius

| Area | Effect |
|---|---|
| Admin → Brands → one brand | Correct name, status, GST, city; address, pincode and pin now shown |
| Admin → creator by id | Phone, joined, last-checked, correct balances |
| `GET /brands/:id` | Gains `city`, `state` from the user record. Admin-only route already. |
| `GET /influencers/:id` **as admin** | Gains an explicitly gated admin block |
| `GET /influencers/:id` **as a brand** | **Unchanged.** Asserted by test. |
| Mobile apps | Untouched |

## The risk worth naming

The creator endpoint is shared with brands. A careless fix leaks creator phone numbers and
earnings to every brand on the platform. The admin fields are therefore attached in a
separate gated block rather than added to the shared select, and a test asserts the brand
response does not carry them.

## The money fault

Wallet and pending balances were divided by 100 on display. Since migration 021 money is
held in rupees, so the page showed one-hundredth of the truth. Removing the division makes
the figure larger — correct, but worth knowing before it surprises anyone.

## Reversibility

Front-end and API-shape only. Nothing is written, nothing migrated; a revert restores the
previous behaviour exactly.
