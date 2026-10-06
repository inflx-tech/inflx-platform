# Feature Spec — Shiprocket connector repair (Round 1 of going live with a real courier)

> Step 2 of the contract-driven workflow. Written and agreed BEFORE any code.
> Founder, 6 Oct 2026: "Values got saved correctly, pls start your connector repair."

## Problem / goal

**What exists.** A creator's parcel (item 11, Remote) is booked, tracked, returned and paid for
end to end — against a practice courier. A Shiprocket connector was written from memory of the
public documentation on 22 Sep 2026 and left switched off, with seven questions "only the live
account can answer".

**What we found.** On 5 Oct 2026 the connector was read against Shiprocket's published
reference (the relaunched developer portal, release 2026-10). It would fail at ten points of a
parcel's journey — a refused booking, a return that cannot be booked, a cancel that cancels
nothing, an empty wallet that looks like a success, and tracking updates that are all lost.

**What we are changing (functional).** After this round, when the two switches are turned on, a
brand can send a creator a parcel through Shiprocket and get it back, with the same rules, money
and screens as today. Nothing a brand or a creator sees changes while the switches stay off.

## Scope

- In scope — the connector, and the four places outside it that only a real courier exercises:
  1. Coverage: "can a courier collect a return from her pincode" is asked as a return, not
     guessed from the outbound answer. A pincode no courier serves is "no", not an error.
  2. Price: the parcel's value and box are sent; the cheapest courier is the one booked, so the
     price the brand saw is the price INFLX pays. One Render switch says whether Shiprocket's
     prices already contain GST.
  3. Store registration: each store address gets its own short code, so two stores with the same
     name, a long name, or a store that moves cannot collide. The booking uses that code.
  4. Outbound booking: every field Shiprocket marks required is sent; phone numbers are sent as
     ten digits; an item code is never repeated.
  5. A booking Shiprocket refuses with a "success" reply (an empty wallet) is a failure: nothing
     is charged, and the half-made Shiprocket order is cancelled.
  6. Cancel: the booking is cancelled by Shiprocket's own order number. If Shiprocket will not
     cancel, the brand is not refunded for a courier that is still coming.
  7. Tracking updates: an address Shiprocket accepts (theirs may not contain their own name),
     their date format, and their status words — including the words a return parcel uses.
  8. Return booking: the items, their value and the contact emails are sent; a tracking number is
     assigned; the pickup is asked for on the day she chose. A return that could not be booked
     leaves her able to book again.
  9. Weight-difference charges: fetched once a day, because Shiprocket does not push them.
  10. A sign-in that has expired is renewed once and the call repeated.
- Explicitly out of scope:
  - Shop orders (store → shopper) and shopper returns through a courier — Round 2, its own item.
  - A low-wallet alert for the INFLX Shiprocket wallet, and telling the courier "try again on
    this day" after a missed delivery. Neither exists today; both are listed for a later round.
  - A parcel Shiprocket reports as lost or damaged: the update is stored, nobody is told
    automatically. Listed for a later round.
  - Turning the switches on. That is the founder's decision after one real test parcel.

## Surfaces touched
- App(s): backend only. No website page and no phone screen changes.
- Roles involved: brand, creator (through item 11's existing screens); INFLX admin (Render).

## Data / contracts
- New or changed tables / columns / migrations: **none.** `brand_branch_pickups.provider_pickup_id`
  now holds the store's Shiprocket code (the value a booking needs) instead of a number nobody
  read; `shipments.provider_ref` now holds `shipment:order` (both Shiprocket ids).
- New or changed API endpoints:
  - `POST /v1/webhooks/shipping/courier` — a second name for the existing Shiprocket update
    address. Same handler, same secret. The existing `/shipping/shiprocket` keeps working.
- New Render setting (optional): `SHIPROCKET_RATES_EXCLUDE_GST=true` when the first real parcel
  shows Shiprocket's quoted price is before GST.
- Money/units: rupees throughout. No wallet rule changes. The brand-facing price is rounded UP to
  a whole rupee (it was rounded to nearest), so INFLX never recovers less than it pays.

## Non-functional
- Auth/role gates: the update address fails closed — no secret configured, or a wrong one, is 401.
- The adapter stays switched off twice (`SHIPPING_PROVIDER`, `SHIPROCKET_ENABLED`). The test that
  proves no call leaves the server while off must stay green, unchanged.
- The shipping folder still imports nothing about collaborations (item 16's guarantee).
- Failure modes the feature must handle: listed 1–10 above; each has a check in
  `03-expected-outputs.md`.

## What only a live parcel can still answer
1. Whether a store whose phone Shiprocket has not verified can ship (`phone_verified: 0`).
2. Whether couriers collect returns in Guntur and Vijayawada.
3. Whether the quoted price contains GST (the new switch is the answer's home).
4. Whether the account has a cap on store addresses.
5. The exact status words on a real return parcel (the reference shows `RETURN PENDING` only).
