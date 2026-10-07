# Impact Analysis — Courier-ready addresses

> Step 6. Generated BEFORE writing implementation code.

## Verdict
One additive migration, a stricter rule on a store's street address, two new branch fields, one
label. Brands with a complete address notice only the new label and two new boxes; brands with
an incomplete one are asked to complete it the next time they edit that branch or ship from it.

## Affected files (read or change)
- backend:
  - `migrations/205_branch_landmark_phone.sql` (+ `scripts/run-205.js`)
  - `src/services/brandBranches.service.js` — the rule, landmark, phone, `courierReady`
  - `src/controllers/brand.controller.js` — registration applies the rule
  - `src/services/remoteParcel.service.js` — refuse an incomplete branch; hand the courier the
    brand's name, the store phone and the landmark
  - `src/services/remoteReturn.service.js` — the return is addressed the same way
  - `src/services/remoteAddress.service.js` — creator street 190
  - `src/services/productionCopy.js` — two sentences
  - `src/services/shipping/shiprocket.js`, `shipping/index.js`, `shipping/simulator.js`,
    `shipping/contract.js` — second address line, sender name
  - `src/services/profileCompleteness.service.js`, `src/controllers/influencer.controller.js` —
    read only (they say "nearest major city" for the CREATOR; out of scope)
- mobile: `screens/brand/BrandBranchEditScreen.js`, `screens/brand/BrandRemoteBookScreen.js`,
  `screens/auth/BrandRegisterScreen.js`, `screens/auth/RejectedScreen.js` (brand half),
  `screens/influencer/RemoteAddressScreen.js`, `components/registration/OfferedStateCityFields.js`,
  `components/discovery/copy3.js`, `components/remote/copy11.js`, `utils/storeAddress.js` (new)
- web: `Packages/brand-web/app/login/page.js` (sign-up), `app/dashboard/settings/profile/page.js`
- shared: none

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| POST | `/brands/register` | street rule (422 `address_line`) | brand app, website |
| PATCH | `/brands/me` | street rule when `address_line` is sent | brand app, website |
| POST/PATCH | `/brands/me/branches[/:id]` | street rule; `landmark`, `phone` accepted | brand app |
| GET | branches, `/brands/me`, Remote read | branch gains `landmark`, `phone`, `courierReady`, `courierProblem` | brand app, website |
| POST | Remote `quote` / `book` / `rebook` | 422 `BRANCH_ADDRESS_INCOMPLETE` | brand app |
| POST | creator Remote `address` | street > 190 is 422 (was 300) | creator app |

## Affected workflows (regression surface)
- Brand registration and profile — `backend/tests/registration-profile.test.js`, `brand.test.js`,
  `item3-branches.test.js`, `item3-profile.test.js`; mobile `registrationProfile.test.js`,
  `item3Brand.test.js`
- Store Visit planning (reads the branch address) — `item10-*.test.js`
- Remote parcels — `item11-*.test.js`, `shiprocket-connector.test.js`, `shipping-layer.test.js`;
  mobile `remote11.test.js`, `remoteScreens.test.js`

## Migration / deploy / OTA impact
- Migration 205 on production first (additive, two nullable columns, no backfill) — `run-205.js`.
- Push → Render (backend) + Vercel (website).
- Mobile JS changed → OTA for the brand app and the creator app. No native change, no APK.
- Order matters: migration → push → OTA. An OLD app against the NEW server keeps working: it
  sends no landmark or phone (left as they are) and shows the server's new red line under the
  street box, because it already prints server field errors there.

## Risk notes
- **A stricter rule at registration.** A store with no number of any kind must type a building,
  plot or ward number. Founder's decision, 7 Oct 2026.
- **Ten of fourteen live branches** do not meet the rule. They are not changed; they are refused
  only at the two moments the rule matters (saving that branch, shipping from it), each time with
  the sentence that says what to add.
- **The store's code with the courier is a fingerprint of its address**, so adding a landmark or
  changing the phone registers the store again under a new code — by design; the courier has no
  way to edit an address.
- **`reseller_name`** (the sender printed on the label) is in the courier's reference as an
  optional field; what the label actually prints is one more thing the first real parcel shows.
- Rollback: revert the commit; the two columns can stay (nullable, unread by older code).
