# item20-own-brand — workflow

Discussion (10 Oct: his brief, my six recommendations, "i agree all your recommendations… we keep this
social media upload but no approval") → code survey (`00-survey/`, three passes) → board v1 (19
screens, five decisions) → **founder lock** ("All five decisions are ok and Lock the screens, start")
→ board v2 records the decisions → master rules §2 written as v1.33 → impact (`05-impact.md`;
baseline `backend/baseline_item20.json` = a full run on an untouched copy of HEAD) → build:

1. migration 206 — the link table, the link codes, `own_brand` on posts, the post rule relaxed to
   "a collaboration or his own brand", `order_lines.campaign_influencer_id` nullable, the places table;
2. the link service and its routes (creator and brand), the two notices;
3. own-brand posts through the post service: who a post is for, what he may sell, send, approve;
   the shop pool, the code lookup, pricing, the wallet's sales list, Home, stats;
4. where he shared it;
5. phone: sign-up step 3, My brand, Linked creators, the Create steps, the post page and its places
   card, Stats, the brand's Sales money; website: Wallet, Orders, the admin post queue and creator review;
6. tests: `backend/tests/item20-own-brand.test.js` (real API, real database, an order placed through an
   own-brand post and followed to the brand's wallet) and `Packages/Mobile/src/screens/__tests__/ownBrand20.test.js`;
   full backend compare against the baseline (bar: 0 newly failing); the whole phone suite

→ **explicit go** → migration 206 on production → push → OTA influencer, then brand.
