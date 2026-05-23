# billing-revenue-reconciliation — Glow Studio month-1 = ₹7,094 (Phase A8)

> **Phase A8 of the INFLX 3-Layer Revenue Model — final phase.** A
> single test that proves the three layers compose to the exact total
> from the brief's locked walkthrough: ₹7,094 of INFLX revenue from
> Glow Studio salon in month 1.

## What ships
- `backend/tests/revenue-reconciliation.test.js` — single end-to-end
  reconciliation test exercising all three layers' service-level math
  + DB state.

## What's proven
- L1: `computeL1Renewal` returns ₹2,499 for an active Growth subscription.
- L2: `lockEscrowFeeAtPublish` returns 3% on a ₹50,000 engagement campaign (₹1,500 fee) and 3% on a ₹5,000 hybrid campaign (₹150 fee).
- L3 Path B salon: 5% on ₹2,000 = ₹100; 5% on ₹50,000 = ₹2,500.
- L3 Path C salon: 7% on ₹3,000 = ₹210 (attribution_clicks row active).
- L3 Path A salon: 9% on ₹1,500 = ₹135 (no attribution).
- **Sum: 2,499 + 1,500 + 150 + 100 + 2,500 + 210 + 135 = ₹7,094.**

## Why service-level (not HTTP)
Each layer is independently endpoint-tested in earlier phases (A3
pricing-service, A4 quotaCheck, A5 transaction.controller wire-up,
A6 subscription endpoints). Phase A8 is the gross-check that the
three layers compose — proving the locked total from the brief is
achievable with the system as built.

## Status of revenue-model phases (after A8 ships)
| Phase | Status | Notes |
|---|---|---|
| A1 schema (M058) | shipped | commit d727f4a |
| A2 column rename (M059) | shipped | commit b41de49 |
| A3 pricing.service extension | shipped | commit 83de459 |
| A4 quotaCheck middleware | shipped | commit ac01c5b |
| A5 L3 wire + attribution | shipped | commit 94fd009 |
| A6 subscription API + cron | shipped | commit e53e9d5 |
| A7 brand-web + admin UI | **DEFERRED** | blocked on Window B foundation merge (per §7 brief) |
| A8 reconciliation | THIS | final commit |
| A6.5 live Razorpay | DEFERRED | follow-up; mock-mode complete |
