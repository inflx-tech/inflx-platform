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

---

## Phase 3 — the screens

Eighteen screens were named; **R17 needed no code** (the admin settings page is data-driven, so
the new number drew itself) and **R18 was built in Phase 2b**. The remaining sixteen are one
address screen and five surfaces, because most of the R-numbers are the same screen at a
different moment.

### Creator · R2, R8, R9, R11, R12, R16 — one screen

**Before:** nothing. A Remote collaboration reached her Collabs list and opened the invitation,
which said what she had agreed and then stopped. There was no way for her to give an address,
see a parcel, or say what arrived.

**After:** one screen that changes with the shoot, exactly as item 10's does.

| Stage | What she sees |
|---|---|
| Not sent | "Send your delivery address" — the only thing on the screen, because it is the only thing she can do |
| Sent | "They haven't sent your products yet. Nothing for you to do." |
| On the way | The tracking number in the mono font on a solid-ink card, the five-step line naming her city in the middle, and "What's coming" with a Return or Gift tag on every line |
| Delivered | Received / Missing / Damaged per line, with a note when something is wrong, under the sentence "Something wrong won't stop your shoot" |
| Checked | The date she checked, and one button to mark the shoot done |
| Shot | The return card — how many items, by when, and "You pay nothing" |
| Delayed | The amber chip and one line saying nothing was lost |

**The money is absent from every one of those states.** She is never shown what the parcel cost,
what was locked, or what came back — that is the brand's business, and the server does not send
it to her.

### Creator · R3, R4a, R4b — her address

**Before:** nothing. **After:** the four-part address of §2B using the *same two fields*
registration, the profile and the branch editor already use, with her name, number, state and
city arriving filled in. The pincode is checked against the courier network as she leaves the
field: a pincode couriers cannot reach turns the field red with the server's own sentence and
disables the button; one they deliver to but cannot collect from shows an amber warning and
lets her carry on. The confirm sheet lists exactly what she is about to send and says, in amber,
that it cannot be changed afterwards.

### Brand · R1, R7, R10, R13, R14, R15a, R15b — one screen

**Before:** nothing for Remote. The brand's set row opened the agreement.

**After:** the gate card and step line are item 10's, unchanged. Then:

| Stage | What the brand sees |
|---|---|
| Waiting | "She sends her delivery address first… nothing to do yet", and **Pick products disabled** with "Opens when her address arrives" |
| Her address here | The locked address card with her number, her note and her sizes — the first screen on which any of it appears |
| Booked | The tracking card, the step line, the locked list, Download label, and Cancel booking |
| A difference | The items she flagged, named, under "Her shoot carries on", with **Report to INFLX** and **It's fine, carry on** |
| The return arrived | Item-by-item confirmation with the auto-confirm date stated |
| Back to the store | What happened, what it cost, and **Book it again** |
| Delayed | Nothing moved, said in rupees |

### Brand · R5 — picking the products

Her address, number and sizes at the top; the selling scope named ("Whole store", a category, a
count, or "Your catalogue" for Pay for Content); a search box; and a row per product with a
1–5 stepper and a Return/Gift switch. **A collaboration whose selling scope was never set shows
a sentence, not an empty list.** Where couriers cannot collect a return from her pincode, the
warning appears above the list, before anything can be marked Return.

### Brand · R6, R6b, R7 — booking

Branch radios with the main one first; **a branch with no street address cannot be selected and
says "Needs a street address and pincode"**, so item 10's refusal is prevented rather than
merely answered. Box presets or typed dimensions, the packed weight with its warning about
being reweighed, and then one price: shipping, the return lock named with its item count, the
total, the wallet balance, and the line that says the money locked for her fee is never used
for shipping. A short balance replaces the booking button with the shortfall as an amount and
**Add money** — the same shape as the balance check at signing.

### What this cost in new native code: nothing

The label opens with `Linking.openURL`, the way the Agreement PDF already does, so the whole
item ships over the air. No new native module, no APK rebuild.

*(44 mobile tests cover these: every screen is mounted at every stage with the server's real
response shape, because React Native has no compile step and an unrun screen is an unverified
one.)*
