# 02 — Workflow (follower-facing flows)

## How a claim attaches (the two doors)
- **Door A — link/store:** follower taps a creator's social link → app opens the
  creator's store (Slice 3) → adds a product → the line is stamped with that
  creator's claim. Same when browsing a creator's store in-app.
- **Door B — code:** follower shops a brand normally, taps **"Have a creator
  code?"** at checkout, enters the code → the creator's **allocated** products for
  that brand in the cart get the claim + the creator's discount; everything else
  stays organic.

## At checkout (the split — invisible to the follower)
1. Each line carries `claim` (a creator) or nothing (organic).
2. The cart groups by **(brand + claiming-creator)** → one sub-order per group.
3. Follower sees ONE flat list, one bill, pays once.
4. Backend writes one order per group: creator-claimed groups credit that
   creator's commission (held until the return window); organic groups are
   brand + platform only.

## Scenario outcomes (what the follower experiences)
| Follower does | Result |
|---|---|
| Taps creator link → store → buys | Creator credited (Door A). |
| In-app creator store → buys | Creator credited (Door A). |
| Enters creator code at checkout | Creator credited for allocated items (Door B). |
| Browses category/brand → buys | Organic (no creator). |
| Cart: Sana's item (A) + Rohit's item (B) + an organic item | Sana credited for A, Rohit for B, organic stays organic — all in one bill. |
| Two items same brand via two creators | Each line keeps its own creator. |

## After Place Order (all at once)
- Follower: `order.confirmed` (exists).
- Brand: `order.placed` (new — Slice 4).
- Creator(s): `commission.sale` "₹X earned" (new for online orders — Slice 4).
- Each creator's commission lands in pending → released after the return window
  by the existing daily cron.
