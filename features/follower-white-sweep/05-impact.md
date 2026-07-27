# Impact

**One-line verdict: mobile-only (no backend, no OTA-independent risk) —
one nav flip + reskins; every business flow byte-identical.**

- The flip changes WHERE surfaces live, not what they do. The only
  external navigate target ('HomeTab', from SavedScreen) keeps working.
- ProfileStack registrations checked against the duplicate-route-name
  native-crash class: every added name appears once in that stack.
- MeScreen rewrite drops the old stats/wallet cards (counts were
  best-effort approximations) for honest rows; wallet is data-gated.
- Reskins are token/shim swaps — zero logic edits in Addresses,
  Followed, Saved.
- Deploy: push is deploy-inert for Render/Vercel; ships via OTA.
