# Expected Outputs — A3
- `lib/contracts.js` is the single source of the wallet-lock formula.
- No remaining inline copy of `(fee+bonus)*(1+pct/100)` in list/hub/modal.
- `next build` compiles clean.
- Founder verify on Vercel: the lock total on the list strip matches the per-contract lock
  in the hub tab and the modal.
