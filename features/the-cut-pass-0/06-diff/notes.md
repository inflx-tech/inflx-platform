# Before / after — pass 0, closing the front door

**Screens:** the brand signup form, on the website (`Packages/brand-web/app/login/page.js`)
and on the phone (`Packages/Mobile/src/screens/auth/BrandRegisterScreen.js`).

## Screenshots

**Not captured, and not faked.** Both are behind a phone-number sign-in with a live
one-time code, and the registration step only renders for a phone number that has never
registered. Putting a mockup render in both panels would satisfy the gate and prove
nothing.

What replaces them: the founder device walk below, and — new since this session — the
emulator harness, which can reach the brand app's registration screen directly.

## What was implemented

| | Before | After |
|---|---|---|
| Business type, website | Two dropdowns: pick 1 of 7 industries, then 1 of 30 types | One stated line: **Fashion — clothing, footwear, jewellery & accessories** |
| Business type, phone | Two rows of chips: 9 industries, then up to 9 types each | The same stated line |
| Server, on registration | Accepted **any** non-empty string | Refuses anything but fashion, with a readable reason |
| Server, on profile edit | `category` freely writable — a fashion brand could become a restaurant | Same refusal, but **only when the field is actually sent** |
| Business-name placeholder | "e.g. Spice Garden Restaurant" | "e.g. Label Fern" |

## What was deliberately NOT done

- **Nothing was deleted.** No screens, no server abilities, no data, no product builders.
  The restaurant, rental and salon machinery is untouched and still works for the brands
  already on it. That is passes 1–4.
- **The two-step picker was removed rather than reduced to one option.** A picker with a
  single choice is worse than a statement, and leaving the retired list in the file
  invites someone to re-enable it by accident.
- **A stale signup draft is no longer restored on the website.** A draft saved before
  today can carry `category: "restaurant"`; restoring it would put a dead choice back
  into a form that no longer offers it, and the server would refuse it anyway.

## A bug caught before it shipped

The new "stated business type" panel on the phone was written against a palette token
`P.bgSoft`, which **does not exist** in that screen's palette (it is `P.surface2`). A
missing style token throws at module load — the screen builds cleanly and dies on the
handset. This is the exact failure class recorded three times in this repo's history.
Caught by reading the palette rather than assuming it; fixed before commit.

## What to check — the device walk

1. **Open brand signup on the phone with a fresh number.** Confirm there is no industry
   row and no business-type chips — just one line naming Fashion, and a sentence saying
   other business types are not supported yet.
2. **Confirm the form still submits** and reaches the "waiting for approval" screen.
3. **Same on the website.**
4. **Open an existing brand's profile and change its address.** Confirm it saves. This is
   the one that matters most — the gate must not lock out the nine brands already
   registered, including the restaurant.
5. **Confirm the existing restaurant brand still loads its own product screens.** Nothing
   about it was removed in this pass.

## Known, and not fixed here

The founder asked that a fashion brand be asked **at registration whether it has a
physical store**, so the pay-in-shop feature can be offered correctly. That is an
addition, not a removal, so it is deliberately not in pass 0 — it is recorded in
`Docs/THE_CUT.md` under KEEP and will be built with the spine.
