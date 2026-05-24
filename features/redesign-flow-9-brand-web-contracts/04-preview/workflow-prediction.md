# Workflow prediction — Flow 9

`mockups/web.html` shows the contracts inbox in 3 states:
1. Normal — 6 contracts with mixed goals + production-modes + bonus
2. Selected (3 of 6 ticked) — wallet strip shows running lock + wallet headroom OK
3. Wallet-short — 5 of 6 ticked pushes lock > wallet, Sign button disabled
4. Empty state — no contracts pending

| Mockup section | Real source | Implementation note |
|---|---|---|
| Header (count chip + Refresh) | `contracts.length` + `load()` handler | Outfit H1 + yellow rule + ghost Refresh CTA |
| Wallet status strip | `walletApi.getBalance().wallet_balance` + `totalLock` derived | Always-visible (vs only-when-selected today). Top-up link → /dashboard/wallet |
| Sticky bulk action bar | `selected` Set + `toggleAll` + `signSelected` | Same handlers, restyled. Ink primary button with yellow text. |
| Contract row · @handle + tier | `c.instagram_handle` + tier derived from `c.followers_count` | Tier chip via threshold: <10K nano · <100K micro · <1M macro · ≥1M mega |
| Contract row · meta line | `c.campaign_name` · `c.influencer_signed_at` · `c.production_mode` | Mono date · chip for production mode |
| Format chips (NEW use) | `c.formats_json` — already in listBrandPending SELECT | Rendered as `1 reel · 2 stories` chips |
| Followers count (NEW use) | `c.followers_count` — already in SELECT | Mono number under @handle |
| Lock amount | `lockAmount(c) = (fee + bonus) × (1 + platform_fee_pct/100)` | Identical formula; bigger mono presentation |
| Review link | `/dashboard/campaigns/{c.campaign_id}` | Points at Flow 6 hub (unchanged) |
| Empty state | `contracts.length === 0` | Yellow-pale card + friendly icon + link to /dashboard/campaigns |
