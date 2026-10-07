# Feature Spec — Courier-ready addresses

> Step 2 of the contract-driven workflow. Written and agreed BEFORE any code.
> Founder, 6 Oct 2026: "check what we have as an address in our application … what info we are
> collecting which is acceptable for shiprocket … if not sync with our requirement pls fix that."
> Founder, 7 Oct 2026, on the proposal and its screens: "Remove label 'Nearest major city' instead
> simply ask city … I agree all your recommendations."

## Problem / goal

**What exists.** A store's address is one free-text box (up to 200 characters) plus pincode, state
and "Nearest major city". Nothing checks that a courier could find the store. The courier is told
the store is called "Main Branch" and is given the owner's login number as the store's phone.

**What it costs.** Shiprocket refuses a pickup address that is shorter than 10 characters or has
no number in it. On 6 Oct 2026, 10 of the 14 store branches on the live platform would be
refused (4 with no address, 6 with no number — "Benz Circle, Vijayawada"). Each of those brands
would only be told "the courier could not be booked".

**What we are changing (functional).**
- A brand typing a store address is told what a courier needs, and cannot save one without a
  shop or door number.
- A brand can add a landmark and a store phone.
- A brand whose old address is incomplete is told exactly what to fix when it prices or books a
  parcel — and sees it on the branch it would pick.
- The courier and the label are given the brand's name, not "Main Branch".
- The city field is labelled "City". The list is unchanged; someone whose town is not on it picks
  the nearest one.
- A creator's street box stops at 190 characters, which is all a courier keeps.

## Scope
- In scope:
  1. Street address rule, everywhere a STORE address is typed: 10 to 140 characters, with a
     number that is not just the pincode. Brand registration (app and website), re-submit after
     rejection, Add / Edit branch, the website's profile page.
  2. Two new optional-to-store fields on a branch, on Add / Edit branch: Landmark (up to 45
     characters) and Store phone (a 10-digit mobile; starts as the login number).
  3. "City" replaces "Nearest major city" / "Your nearest major city" on those store screens,
     with one helper line: "Not on the list? Pick the nearest city."
  4. Pricing and booking a creator's parcel refuse a branch whose address a courier would refuse,
     in a sentence that names the branch and the fix. The branch picker on the booking screen
     says the same before the brand taps.
  5. To the courier: the landmark as the second address line, the store phone, and the brand's
     name — as the store's contact name, as the sender printed on the label, and as who a return
     is delivered to.
  6. A creator's delivery street: 190 characters, with a hint.
- Explicitly out of scope:
  - Existing branches are not rewritten. Each brand fixes its own the next time it edits or ships.
  - The city LIST (146 offered cities) and the creator's own registration / profile screens,
    which still say "Your nearest major city" — the founder's instruction was given on the store
    screens; asked back as one question.
  - A shopper's delivery address — already separate house, street, area, landmark, receiver.
  - Splitting the street box into door / street parts (considered; Shiprocket itself takes one
    line plus a second, which is what this now matches).

## Surfaces touched
- App(s): backend · mobile (brand: registration, re-submit, Add / Edit branch, Book the parcel;
  creator: delivery address) · brand-web (sign-up, Settings → Profile)
- Roles involved: brand, creator

## Data / contracts
- Migration 205 (additive): `brand_branches.landmark text`, `brand_branches.phone text`.
- API, changed:
  - `POST /brands/register`, `PATCH /brands/me` (`address_line`): the street rule.
  - `POST|PATCH /brands/me/branches`: the street rule; accepts `landmark`, `phone`.
  - Branch objects everywhere gain `landmark`, `phone`, `courierReady`, `courierProblem`.
  - Remote `quote` / `book` / `rebook`: 422 `BRANCH_ADDRESS_INCOMPLETE` (field `branchId`).
  - Creator `address`: street over 190 characters is 422 (was 300).
- New validation codes: `BRANCH_ADDRESS_SHORT`, `BRANCH_ADDRESS_NUMBER`, `BRANCH_LANDMARK_LONG`,
  `BRANCH_PHONE`. `BRANCH_ADDRESS_LONG` now means 140.
- Money: none.

## Non-functional
- Auth/role gates: unchanged.
- Failure modes the feature must handle: an old branch with a bad address being edited for
  another reason (the street is checked whenever the screen sends it — the app always does); a
  branch with no store phone saved yet — every branch that exists today (the courier is given the
  login number); a landmark too short for the courier to accept as a line (kept, but not sent).
