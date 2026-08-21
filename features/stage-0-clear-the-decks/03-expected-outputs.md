# Stage 0 — expected outputs

| # | Check | Passes when |
|---|---|---|
| S1 | `GET /brands/me/inbox-summary` | Returns the five original counters **unchanged**, plus `needs_you` |
| S2 | Brand roll-up reconciles | Every node's total = its own items + the sum of its children, at every level |
| S3 | `GET /influencers/me/needs-you` | Returns `total`, `items`, and `collaborations[]` |
| S4 | Step agreement | The same collaboration reports the identical `step` to brand and creator |
| S5 | Step rules | Signed + shoot incomplete → 3. Shoot done → 4. Complete → 6. Declined → closed |
| S6 | Turn rules | `owes()` counts a node only for the side whose turn it is |
| S7 | Auth | Brand route rejects a creator; creator route rejects a brand |
| S8 | Stale clients | No existing key removed or renamed from the brand summary |
| S9 | Practice world seeded | 3 brands · ~22 creators · 2 groups · 6 agreements · 2 campaigns · shoots at ≥3 states · posts live/review/rejected · ~30 stamped sales |
| S10 | Invisible to the public | No seeded product, post or campaign is returned by any follower-facing query |
| S11 | Reversible | The remover leaves production exactly as found |
| S12 | Reels gone | Contract folder and migration 081 deleted; no `%reel%` table exists (already true) |
| S13 | Release flags | Four contracts corrected |
| S14 | Test accounts doc | Matches reality — no mock OTP, no localhost |
| S15 | Device check | The owed v224 path walked on a real phone |
| S16 | No regression | `pnpm qa` green, no check skipped, weakened or deleted |
