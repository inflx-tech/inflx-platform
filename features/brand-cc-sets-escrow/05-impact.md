# Impact — A4
**Frontend-only, brand-web (Vercel) — zero backend.**
- Adds PayoutSection.js; hub gets a Payout tab + deep-link + repointed header/PrimeBar links.
- /escrow + /sets → redirect stubs (routes retired; the /escrow `.esc` CSS outlier gone).
Risk: low — Payout self-fetches the same escrow call /escrow used; redirects preserve links;
sets creation untouched (lives in campaigns/new).
Release: production-impacting via Vercel → founder go; web verify on deployed dashboard.
