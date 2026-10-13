# creator-address-bank-save — built against the board, 13 Oct 2026

Board: `04-preview/mockups/creator-address-bank-save.html` (S1–S2 · P1–P3 · R3, R3a, R3b · W1 · AM3).

## What was implemented

### 3 · Save, without "Discard changes?"
`hooks/useUnsavedGuard.js` now returns `saved()` and reads "is there anything unsaved" at the moment
of leaving. Each screen that saves and leaves calls `saved()` first. Before, the screen told the
guard through state and left in the same breath, so the guard — not yet told — asked about a screen
that had just saved. The first tap HAD saved; the box only stopped the screen closing.

Six live screens had it: Profile info, Niche & languages (creator app); Business details, Links,
What you sell, Add/Edit branch (brand app). The new Delivery address screen is built on the fix.

### 1 · Her delivery address
- `screens/influencer/DeliveryAddressScreen.js` (new) — the form, Save strip, "Remove this address".
- `screens/influencer/ProfileScreen.js` — the second row, "Delivery address".
- `screens/influencer/RemoteAddressScreen.js` — arrives filled from the kept address, with the blue
  line; the courier answer for the arrived pincode is asked without her touching the box; with none
  kept, the tick "Keep this address in my profile for next time".
- Server: table `creator_delivery_addresses` (migration 208), `services/creatorAddress.service.js`,
  `routes/creatorAddress.routes.js`; `remoteShoot.service.js` (prefill), `remoteAddress.service.js`
  (the tick).

### 2 · Her bank account
- `screens/influencer/PayoutDetailScreen.js` — six boxes from `components/profile/addressBankCopy.js`.
- Server: `influencer.controller.js` — one entry, saved whole, the number typed twice; the three
  new words are never sent back. `withdrawalRequest.service.js` — a bank request is addressed to the
  name on the account and carries the bank and branch.
- INFLX admin: `brand-web/app/admin/money/withdrawals/page.js` — Bank, Branch, and the bank beside
  the name in the list.

## Same as drawn?
| Board | Built as | Same? |
|---|---|---|
| S2 Save → Profile, "Saved." | `saved(); navigation.navigate(...)` on six screens | Yes |
| P1 the Profile row | `ProfileRow` second in the list; "Where brands send products for a Remote collab" or "City · pincode" | Yes |
| P2 Delivery address | lead, grey "Only you see this…", Your name, Contact number, House and street (counter /190), Pincode, State, Your nearest major city, Delivery note (counter /200), Save strip | Yes. The two counters are not drawn on the board; they are the Remote form's own |
| P3 opened again | the same form filled, "Remove this address" in red under it, a confirm sheet | Yes |
| R3a she keeps one | blue line on top, every box filled, green courier line | Yes |
| R3b she keeps none | the tick as the last thing before "Review and send", ticked | Yes |
| W1 bank account | lead line, six boxes in the drawn order, first number hidden, red line under the second on a mismatch | Yes |
| AM3 Mark processed | To = name on the account; Bank and Branch after IFSC | Yes — seen in a browser on a local copy with two seeded requests |

## Decisions taken for the founder (each told to him)
1. **The address is optional** — not one of the "things left" before review.
2. **Private** — its own table; no route for a brand or for admin; the Profile row shows city and
   pincode, never the street.
3. **The courier check stays on the collab**, not on the profile.
4. **"Keep this address in my profile" is ticked to begin with**, shown only to a creator who keeps
   none, and never overwrites an address she keeps.
5. **"Account holder name" was added** to the three he asked for.
6. **The first account-number box hides its digits** and the second cannot be pasted into.
7. **No format check on the number or the IFSC** — unchanged from registration-and-profile §5 ("the
   team checks these by hand").
8. **Accounts saved before this keep working.**
9. **Creator app only** for the bank form; the brand's is unchanged. Offered to him.
10. **The Save fix was applied to every screen that had the fault**, including four in the brand app
    he did not name.

## Found while building, and fixed
**The Remote form greyed out "Review and send" without saying why.** When a courier cannot reach
her pincode the button goes grey; the reason was only ever written when that button was pressed —
which it could not be. Typing a pincode and leaving the box produced a dead button and no words.
With a pincode that now arrives from her profile she would meet that having done nothing, so the
server's sentence ("Couriers don't deliver to 522002 yet. Try an address at a pincode nearby…")
now shows in red under the Pincode box, and goes when she types one that can be reached.

## What diverged from the board
None in what is drawn. Two things the board does not show: the character counters on P2 (above),
and the bank row's subtitle on Payment details, now "Name, account number, IFSC, bank and branch"
(was "Account number + IFSC").

## Tests
- `backend/tests/creator-address-bank.test.js` — 17, through the real API: A1–A9, K1–K8.
- `Packages/Mobile/src/hooks/__tests__/saveLeavesWithoutAsking.test.js` — 28, on the real native
  stack: S1–S4 on seven screens. S1 was red on all six live screens before the fix.
- `Packages/Mobile/src/screens/influencer/__tests__/addressBank.test.js` — 24: P1–P3, R3, W1.
- Rewritten (business-rule drift — the bank entry is five parts): two tests in `item3Creator.test.js`,
  one line in `registrationProfile.test.js`.
- Extended as they demand: the two screen inventories (`saveBarScreens.test.js`,
  `creatorStrips.test.js`) gain the new screen, and every rule in them runs on it.
- Mobile: whole suite — 127 suites / 2,989 tests, all passing.
- Backend: whole suite, serial — 155 suites / 2,200 tests; the same 177 known failures as the last recorded run, 0 newly failing, 17 new all passing (`backend/baseline_creator_address_bank.json`).
- Migration 208's runner proved on a scratch database built from migrations 001–207: dry run, apply
  (12 of 12), apply again (12 of 12, nothing moved).

## Not seen
No screen was looked at on a phone. Maestro not run. The admin page was seen in a browser on a local
copy; the app screens are proved by tests only.
