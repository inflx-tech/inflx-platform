# 04 — Workflow prediction (mockups)

## Mockups
- **`cart-code.html`** — the **code door** (Slice 2), two states:
  1. *Before code:* a claimed item ("via @sana_styles", from her store) + an
     organic item ("Added by you") + a "Have a creator code?" field above the bill.
  2. *Code applied:* `SANA10` resolves to @sana → an applied chip + a bill line
     "@sana_styles offer (SANA10) −₹137". The discount hits **only her allocated
     items** for that brand (the jeans); the organic tee is untouched.
- **`cart-multi-creator.html`** — the **per-line claim** (Slice 1):
  - *Follower view:* one flat list, one bill. Each creator-driven item shows a
    small "via @creator" pill; the self-found item says "Added by you". Two
    creator offers show as separate bill lines.
  - *Behind the scenes panel:* one payment → three sub-orders grouped by
    (brand + claiming creator) — Sana's jeans, Rohit's shoes, organic tee. Two
    same-brand items split because the claim lives on the line, not the cart.

## Predicted behaviour (what the build must reproduce)
- A line stamped with a creator (link/store or code) renders the "via @creator"
  pill; an unstamped line renders "Added by you".
- The bill shows one discount line per claiming creator; organic items contribute
  no creator discount.
- Entering a code claims **only that creator's allocated products** for that brand;
  a line already claimed via link is not overridden (link wins, last-click).
- Place Order → one payment; backend writes one order per (brand+creator) group;
  each creator credited only for their items; organic groups pay no commission.
- Follower-facing: still ONE flat list + ONE bill (the locked rule holds).

## Not shown (separate slices)
- Link door routing (Slice 3) — no new screen, just the social link opening the
  creator store with the tag.
- Post-order pings to creator/brand (Slice 4) — backend only.
