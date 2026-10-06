# Workflow Definition — Shiprocket connector repair

> Step 3. The executable contract: each numbered step becomes an assertion.

## Actor
The INFLX server, talking to Shiprocket on behalf of a brand and a creator who are using item
11's existing Remote screens. No person does anything new.

## Preconditions
- `SHIPPING_PROVIDER=shiprocket` and `SHIPROCKET_ENABLED=true` (off in production today).
- An API user's email and password, and a shared secret word, are set on the server.
- In the tests Shiprocket is replaced at the connector's own transport by a stand-in that answers
  in the shapes the published reference documents — so what is asserted is what INFLX SENDS and
  how it READS the reply. No call leaves the machine.

## Workflow steps (what the server does, and what must be true)
1. She types her pincode → INFLX asks Shiprocket for couriers store → her, and (as a RETURN) her
   → store. "Delivers" and "can collect a return" are two separate answers.
2. The brand opens the price → INFLX asks again with the box, weight and value, and shows the
   cheapest courier's price for the way out and the way back.
3. The brand books → the store is registered under its own code (once per address) → the order is
   created with every required field → the same cheapest courier is asked for a tracking number
   → the pickup is requested → the label is fetched.
4. Shiprocket says "OK" but assigns no tracking number (empty wallet) → the booking fails, the
   Shiprocket order is cancelled, the brand is charged nothing.
5. The brand cancels before collection → Shiprocket's order is cancelled by its order number →
   only then is the brand refunded.
6. Shiprocket posts an update to `/v1/webhooks/shipping/courier` with the secret → the parcel
   moves (collected, out for delivery, failed attempt, delivered, back at the store).
7. She books the return for a day → a return order with its items is created → a tracking number
   is assigned as a return → the pickup is requested for her day.
8. Once a day INFLX reads Shiprocket's weight differences → each becomes one weight charge on the
   parcel it belongs to, once.

## Success definition
Every step sends what the reference requires and reads what the reference returns, proven by
`backend/tests/shiprocket-connector.test.js`; item 11's existing suites are unchanged and green;
and with the switches off no call leaves the server.

## Failure / edge workflows
- No courier serves the pincode → "not deliverable", never a server error.
- Shiprocket refuses the cancel → the brand is told to try again; no refund is written.
- The return cannot be booked → she is told to try again, and she can.
- An update with a wrong or missing secret → 401, nothing stored.
- An update whose status INFLX does not act on (lost, damaged, in a hub) → stored raw, 200.
- The same weight difference read on two days → one charge.
- The sign-in has expired → signed in again once, the call repeated.
