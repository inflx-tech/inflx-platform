# Diff notes — courier-ready-addresses

Against `01-spec.md` and the locked screens `04-preview/mockups/courier-ready-addresses.html`
(the founder approved them on 7 Oct 2026 with one change — the label is "City").

## Where this stands — read this first

- **Nothing here has been seen on a phone or in a browser.** Every screen line below is from the
  code and from jest. Jest cannot see how a screen looks, whether a hint wraps badly, or whether
  the keypad covers the new Store phone box. A device walk is owed for the five screens listed
  under "Before and after". No after-shots.
- This file existing is what the release gate (Rule 4) looks for. **It is not the diff sign-off.**

## Before and after, screen by screen

**A · Brand app — Edit branch / Add a branch**
- Before: Branch name · Street address (any text up to 200) · Pincode · State · "Nearest major
  city" · a blue note about store visits.
- After: Branch name · Street address with the line "Shop or door number, building, street and
  area. A courier has to find it." and a counter to 140 · **Landmark** (new, optional, counter to
  45) · Pincode · State · **City**, with "Not on the list? Pick the nearest city." · **Store
  phone \*** (new; opens holding the login number) · the blue note now names the courier too.
- A street with no shop or door number shows "Add the shop or door number. Couriers need it to
  find the store." and Save stays off.

**B · Brand app — registration, and re-submit after rejection**
- Before: Street address (any text) · "Nearest major city" with "The closest big city — not your
  exact area."
- After: the courier line under Street address; **City** with "Not on the list? Pick the nearest
  city."; the same red line for a street with no number. On registration the button was already
  off until every field was valid, so the red line appears as soon as she leaves the street box —
  otherwise the button would be off with nothing saying why.

**C · Brand app — Book the parcel, "Collected from"**
- Before: a branch with no address at all was greyed: "Needs a street address and pincode".
- After: a branch whose address has no shop or door number is greyed too: "Needs a shop or door
  number". If it is priced or booked anyway the server answers "Add the shop or door number to
  <branch> first — the courier needs it to find the store. You can do that under Branches and come
  straight back."

**D · Creator app — Your delivery address**
- Before: House and street, up to 300 characters, no hint.
- After: "House or flat number, building, street and area.", a counter, and it stops at 190.

**E · Website — sign-up (step 3) and Settings → Profile**
- Before: "Business address" (any text) · "Your nearest major city" · "The closest big city to
  you — not your exact town or area."
- After: the courier line under the address, which stops at 140 · **City** · "Not on the list?
  Pick the nearest city." · the same refusal for an address with no number.

## One thing added beyond what the founder saw
The helper line under City — **"Not on the list? Pick the nearest city."** His own example (a
store in Gannavaram that cannot find Gannavaram picks Vijayawada) is what it tells the user.
Reported to him; one word from him removes it.

## Not on any screen
- The courier is told whose store it is ("<Brand> - <Branch>"), is given the store phone (or the
  login number when the branch has none) and the landmark as a second address line; the label's
  sender is the brand; a return is addressed to the brand at that branch.

## Deliberately not done
- **The creator's own registration and profile still say "Your nearest major city".** The
  founder's instruction was given on the store's screens. Asked back.
- **Existing branches are not rewritten.** On 6 Oct 2026, 10 of 14 live branches do not meet the
  rule. Each is refused only when that branch is saved again or shipped from, with the sentence
  that says what to add.
- **Splitting the street into door / street boxes.** One line plus a landmark is what the courier
  itself takes.

## What the tests prove
- Server: `backend/tests/courier-ready-addresses.test.js` — 21 checks (the rule case by case;
  registration; Add / Edit branch; landmark and store phone; the profile save; pricing and
  booking refusals with nothing charged; the creator's 190).
- Courier hand-off: `backend/tests/shiprocket-connector.test.js` — 6 new checks (second address
  line, store phone, brand name, the label's sender, the return's addressee, a new code when the
  address changes), 51 in the file.
- App: `courierReadyAddresses.test.js` — 13 checks; `remoteScreens.test.js` — 2 new (the greyed
  branch, the creator's street box).
- Three existing app assertions were updated to the approved new words and payload (the blue
  note's sentence; a branch save now carries `landmark` and `phone`). Assertion drift caused by an
  approved change — updated to the new truth, none loosened or removed.
