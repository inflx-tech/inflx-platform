# Expected Outputs — Shiprocket connector repair

> Step 3 (cont.). Defined BEFORE coding. "Compiles" is NOT an expected output.
> Every check is a jest assertion in `backend/tests/shiprocket-connector.test.js` unless it
> names another file.

## Checks
| # | What must be true | Proof |
|---|---|---|
| 1 | "Delivers" comes from a store → her check; "can collect a return" from a her → store check sent AS A RETURN | the two requests are inspected |
| 2 | A pincode no courier serves (an empty list, or Shiprocket's 404) is `delivers: false` — not an error | both shapes |
| 3 | A price check sends the weight, the box and the parcel's value; a blocked courier is never chosen; no courier → no price | request + result |
| 4 | The price is the cheapest courier's, rounded UP to a whole rupee, GST shown inside it; with `SHIPROCKET_RATES_EXCLUDE_GST` on, 18% is added first | both settings |
| 5 | A store's code is ≤ 36 letters and digits, the same for the same address, different for a different address or a same-named store elsewhere | pure function |
| 6 | Registering sends a 10-digit phone and an address of at most 190 characters; a code Shiprocket already holds is reused rather than failing | request + the refused-then-found path |
| 7 | An outbound order carries every field the reference marks required (20), a 10-digit phone, and no repeated item code | field-by-field |
| 8 | The courier asked for a tracking number is the cheapest one; the reply gives the courier's name, the tracking number and a reference holding BOTH Shiprocket ids | request + result |
| 9 | "OK" with no tracking number (empty wallet) throws, names the wallet, and cancels the Shiprocket order it had just created | request log |
| 10 | A courier-side refusal of the chosen courier is retried once with Shiprocket's own choice | request log |
| 11 | Cancel sends Shiprocket's ORDER number; a parcel booked before this change (no order number kept) cancels by tracking number | both |
| 12 | Item 11: when a real courier will not cancel, the brand is NOT refunded and the parcel stays booked | `item11` service, real-provider row |
| 13 | A return order carries every field the reference marks required (24) including the items, their value and both emails | field-by-field |
| 14 | The return's tracking number is assigned as a return, and the pickup is requested for the day she chose | request log |
| 15 | Item 11: a return that could not be booked is withdrawn, so she can book again | service + row |
| 16 | Shiprocket's own sample update is read correctly: its date (`DD MM YYYY HH:MM:SS`, India time), its tracking number, its status | the sample body, verbatim |
| 17 | Status words map: picked up / shipped / in transit → collected; out for delivery; undelivered → failed attempt; delivered; RTO delivered → back at the store; cancelled | table |
| 18 | A return parcel's words are read with or without the `RETURN ` prefix; a failed PICKUP is a failed attempt on a return only | table |
| 19 | A status INFLX does not act on (lost, damaged, reached hub) maps to nothing and is stored raw | parse + row |
| 20 | `POST /v1/webhooks/shipping/courier` with the secret moves the parcel; a wrong secret is 401; the old address still answers | HTTP, real handler |
| 21 | The update address contains none of the words Shiprocket forbids (`shiprocket`, `kartrocket`, `sr`, `kr`) | string check on the path |
| 22 | The daily read turns each weight difference into ONE weight charge on its parcel; a second read charges nothing more; a difference for a parcel that is not ours is skipped | job, run twice |
| 23 | The daily read does nothing while the switches are off | job |
| 24 | An expired sign-in (401) is renewed once and the call repeated; a second 401 is an error | request log |
| 25 | With the switches off, no call leaves the server — unchanged | `shipping-layer.test.js` check 34 |
| 26 | The shipping folder imports nothing about collaborations — unchanged | `shipping-layer.test.js` |
| 27 | The booking hands the connector the store's registered code, not the store's name | `item11` service |

## Data assertions (post-workflow)
- No new table, column or migration. No row is rewritten.
- No wallet row is written by any test that does not already write one.

## Regression surface that must stay as it was
`shipping-layer`, `item11-test-parcels`, `item11-remote-flow`, `item11-remote-return`,
`item11-phase2a`, `stage4-parcel` — compared file by file against the same suites on the
unchanged tree.

## Visual evidence required
None — no screen changes.
