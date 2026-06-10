# Impact — durable pending-order store

**Verdict: reliability hardening — happy path byte-equivalent, failure paths stop losing orders.**

- Touches: `transaction.service.js` (Map → table; new peek/claim functions), `transaction.controller.js` (5 verify paths: peek + claim-in-tx), migration 098 (additive table, IF NOT EXISTS).
- Behaviour deltas, all in failure paths only: "Order not found or already processed" (single 404) splits into 404 (unknown) vs 409 (already processed); unverified orders persist instead of vanishing; verifies become retryable after transient failures; deploys/restarts no longer kill in-flight checkouts.
- One extra INSERT per payment initiation and one UPDATE per verify — negligible load.
- Wallet top-up path intentionally untouched (live mode verifies against Razorpay's API directly).
- App-side recovery UI (show "payment pending" + retry) is Sprint app work; this contract is the backend foundation it needs.
