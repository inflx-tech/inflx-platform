# Before / after — item 1

## What was promised, and what was built

| Promised | Built |
|---|---|
| Four wrong field names on the brand page | Fixed: `brand_name`→`business_name`, `city` now sent, `gst_number`→`gstin`, `status`→`user_status` |
| Address, pincode and pin shown | New Address block: street, area — pincode, map pin |
| Creator phone sent | Sent, **admin only** |
| The hundred-fold money error | Both `/100` divisions removed |
| — | **More than promised, see below** |

## Bigger than reported

The proposal said the creator page was missing phone, last-checked and had a money fault.
Reading it properly, `GET /influencers/:id` also never sent **`created_at`**,
**`wallet_balance`**, **`pending_balance`**, **`tds_exempt`**, **`tds_override_pct`**, or a
`status` under the name the page used. So Registered, Wallet, Pending, TDS and Status were
*all* blank or zero — nearly the whole page, not the three fields reported.

## The constraint that shaped the fix

`GET /influencers/:id` is `requireRole('brand', 'admin')` — **brands call it too.** Adding
phone and balances to the shared select would have handed every brand on the platform a
creator's personal number and her earnings.

So the admin fields are a **separate query behind `req.user.role === 'admin'`**, and a test
asserts the brand response does not carry them. The public shape is unchanged.

`created_at` is deliberately in the shared select — when a creator joined is not private.

## Applied in two places, on purpose

`u.city, u.state` were added to **both** `getBrandByUserId` (a brand's own record) and
`getBrandById` (the admin lookup). The first was not required by this contract; leaving one
patched and the other not is how the two drift apart.

## Verification

The local test database was unreachable for this work — the container stops serving
connections and Docker refuses state-changing commands. New tests are written
(`tests/admin-account-review.test.js`, 5 checks) and **have not been run**.

Verified instead against production, both queries exactly as shipped:

* brand detail — business name separate from contact name, **Karnal / Haryana** now
  arriving, `user_status` = pending, `gstin` the real column, **House no. 225/7**,
  **132001**, and the map pin.
* admin-only creator block — phone, wallet, and last-checked all returned.

Brand-web builds clean.

**Not covered:** the admin HTTP path end to end. There is **no practice admin account** —
the only admin is the founder's own number, which receives real SMS codes, so no automated
check can sign in as an admin. Creating a practice admin on a fixed-code number would hand
superadmin to anyone who guessed the number, so it has not been done. **This gap is worth
solving deliberately and is recorded as owed.**
