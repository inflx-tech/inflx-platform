# Impact — the negotiation door

**One-line verdict: the last blocking gap between an invitation and a signed contract.**

| Who | What changes |
|---|---|
| **Creators** | Can counter an offer. Could not before, from anywhere. Their notifications also start working — including "your contract is ready to sign". |
| **Brands** | Start receiving counters. The reply flow already existed and is unchanged. |
| Shoppers | Nothing. |
| Admin | Nothing. |

## Deploy classification

**PRODUCTION-IMPACTING via OTA only.** No backend file changed — the server was already
correct. Creator app only; brand and shopper bundles are untouched by this contract.

## Blast radius

Small and additive.

- One new call from a screen that already existed, to an endpoint that already existed.
- One routing function rewritten — it previously matched almost nothing, so the realistic
  failure mode is "still goes nowhere", not "goes somewhere wrong".
- No migration, no schema change, no data touched.

## What could break, honestly

1. **A notification routing somewhere unexpected.** The new router trusts `data.screen`
   from the server. Every value the server sends was enumerated from source before
   writing the map; anything unrecognised falls through to the type fallback and then to
   doing nothing — the same as today.
2. **The opening form on an unusual collaboration goal.** Fee-only, commission-only and
   both are covered by tests. A goal outside those three falls back to asking for a fee.
3. **A creator opening a negotiation the server then refuses.** Handled: the refusal is
   surfaced with the server's own wording.

## Cost of not doing it

Every offer stays take-it-or-leave-it, and the founder's stated finish line — walking a
complete flow through to a signed contract — cannot be reached.
