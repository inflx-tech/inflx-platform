# item11-remote — impact

**In one line: item 11 is the first item that moves physical goods and the first to hold a
creator's street address — so its risk is privacy and money, not features.**

---

## Production-impacting. Explicit go required.

`backend/src/**`, `backend/migrations/191`, both websites and both phone apps. A push deploys
Render and Vercel; the phones need an OTA publish each. **Nothing has been pushed, migration 191
has not run against production, no Render environment variable is set, and no courier has been
called.**

## What changes for a person

| Who | Before | After |
|---|---|---|
| **Creator, Remote** | Her collaboration opened the agreement and stopped. Nothing asked where to send anything. | She sends her address, watches the parcel, says what arrived, marks the shoot done, and sends the Return items back at the brand's cost. |
| **Brand, Remote** | A text box on the website for a courier name and a tracking number, typed by hand. | Picks from her selling scope in the app, books one parcel through INFLX, gets a label, and follows it. |
| **Brand, Store Visit** | — | **Nothing changes.** §2.9's caller audit found the website's own "Mark visit done" live and left it working. |
| **Creator, Store Visit** | — | **Nothing changes.** |
| **Admin** | A Production Queue page fed partly by a dead bucket. | That page is gone; a Test parcels page plays the courier until Shiprocket is live. One new number on the settings page. |
| **Follower** | — | **Nothing changes.** |

## The four findings, and what each now does

1. **`addParcelItems` never worked.** `getContractParties` never selected the brand's id, so
   every add-products call answered "not in your catalogue". Fixed; proved by check 40.
2. **Three endpoints could leak a creator's address the moment one existed.** All three are
   projected now, before any `ship_to_*` column was created. Checks 42, 43.
3. **The Delayed CHECK would have thrown on the first Remote stage.** Widened in 191.
4. **Every brand wallet in production is ₹0.00.** Not ours to fix; the founder tops one up for
   the walkthrough.

## Risk, and what holds it

| Risk | What holds it |
|---|---|
| Her street address reaching the wrong eyes | One projection decides it, and it landed BEFORE the column existed. Three endpoints tested empty-before-send, full-after, and 404 for another brand. |
| Money moving twice, or the wrong way | Every rupee goes through `remoteMoney.service`, which has no path to `contracts.locked_amount`, `escrow_entries` or an influencer balance. Check 29 snapshots all four across a whole shoot and asserts them byte-identical. |
| A courier event arriving twice, or late | A unique index on `dedupe_key`; every state write forward-only. Checks 16, 17. |
| A real courier being called by accident | `SHIPPING_PROVIDER=simulator` is the default, and Shiprocket is switched off twice. A test proves no HTTP call leaves the server. Checks 33, 34. |
| Item 10 regressing | Its suites run green; the only change to its behaviour is the Delayed lane now covering both modes, asserted explicitly on both halves. |
| An unrun screen crashing on a device | Every screen mounted at every stage, 44 mobile tests. The `accessibilityState` rule caught six places in this item's own code. |

## What this does NOT do

No dispute handling (item 18 — item 11 **records** a report). No content step (item 12 — shoot
done only opens it). No customer orders (item 16 — the shipping layer is built so item 16 can
use it, and a test forbids it importing anything about collaborations). No delivery challan, no
GST invoice for courier charges, no aggregator reconciliation — all three are handover notes.

## Rollback

The migration is additive: dropping back to the previous commit leaves every new table and
column unused and harms nothing. The retirements are the one thing a rollback would undo — the
old hand-typed dispatch doors would answer again, and the three address leaks would reopen.
**If anything in item 11 has to be rolled back, Phase 2a should not be.**
