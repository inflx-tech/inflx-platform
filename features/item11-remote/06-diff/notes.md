# item11-remote — before / after

## Phase 2a — what changed on a screen, and what it looked like before

Phase 2a is mostly server-side. Three web surfaces change, all of them **removals**, and each
is here because a creator's street address was about to start existing.

### 1. Brand website · campaign → creators → the shipment panel

**Before:** a "Shipping to" line printed from `shipment_to_address_line / _city / _state /
_pincode`; a free-text **Courier** box with a datalist offering Bluedart, Delhivery, Shiprocket,
DTDC, India Post, Ekart, XpressBees, Ecom Express; a free-text **AWB / Tracking number** box; an
expected-date picker; and a black **Mark as dispatched** button. Then, once dispatched, a card
reading Courier / AWB / Expected and "Awaiting influencer to confirm receipt."

**After:** one read-only card —

> **Remote shoot**
> Parcels are managed in the app. She sends her delivery address there, you pick the products
> and book the parcel, and INFLX arranges the courier and the label.

**Why:** the "Shipping to" line is a creator street address, and the roster no longer sends one
to anybody; the button's endpoint (`dispatch`) is switched off server-side, so it could only
ever have shown an error; and booking a real parcel needs a branch, a box, a weight, a wallet
and a label, none of which fits in a text box on a website. The datalist's "Shiprocket" option
was never an integration — it was a word in a dropdown.

### 2. Brand website · campaign → Production section

**Before:** each creator row read `Ship product · <her address>` when a `delivery_address` was
set, `Store visit · schedule a slot` when it was not, and **`Remote · no logistics needed`** for
anyone not marked `physical_delivery`.

**After:** the row reads from the shoot's **mode**, and says what is true:
`Remote · products are shipped to her, in the app` · `Store visit · agreed in the app` ·
`Not started`.

**Why:** it read `ci.delivery_address` (a creator street address), and its Remote line said "no
logistics needed" about the one flow that is entirely logistics. Both were wrong in the same
place.

### 3. Admin website · Production Queue

**Before:** a nav item (🚚 Production Queue) and a page listing production events needing
attention, in three buckets — a stale `proposed` visit, a shipment dispatched 14+ days ago with
no confirmation, and a reschedule limit reached.

**After:** the nav item and the page are gone.

**Why:** the middle bucket was fed by the hand-typed `dispatch` that Phase 2a switches off, so
it can never fill again; the other two are better served by the Delayed flag and the 48-hour
reminder lane. The **endpoint stays mounted** — item 10's tests read it, and it keeps the gate
column and the Delayed flag it gained in item 10. Its dead shipment bucket and the three
`shipment_*` columns behind it are gone from the projection.

### Nothing else moves in 2a

No phone screen changes. No creator-facing copy changes. The Store Visit flow is untouched end
to end — including the brand website's own **Mark visit done**, which the §2.9 caller audit found
live and which is deliberately still working.

---

*(R1–R18 before/after panels are authored in Phase 3, against
`04-preview/mockups/item11-remote-locked.html`.)*
