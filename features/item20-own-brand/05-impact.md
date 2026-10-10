# item20-own-brand — impact

**Verdict: safe to build, with care in one place. It adds a second kind of post ("for his own brand")
beside the existing kind; a collaboration post, its checks, its price and its money are not changed.
One database migration (206). The money engine is not edited: an own-brand sale is an ordinary sale
priced with commission 0.** Deploy = migration → push → phone updates (creator, brand) → website.

## What is added
- **Database (migration 206):** `creator_brand_links`, `brand_link_codes`, `post_share_places`;
  `creator_posts.own_brand`.
- **Server:** `services/ownBrand.service.js` + `ownBrandCopy.js`, `services/postPlaces.service.js`,
  `routes/item20.routes.js` (creator: brand-link ×5, places ×4; brand: linked-creators ×2).
- **Phone:** `screens/influencer/MyBrandScreen.js`, `screens/brand/BrandLinkedCreatorsScreen.js`,
  `components/ownbrand/` (copy, the link steps, the places card and sheet).

## What is loosened in the database, and why nothing existing moves
| Change | Existing rows |
|---|---|
| `creator_posts_v2_shape`: "has a collaboration" becomes "has a collaboration **or** is own-brand, never both" | every existing post has a collaboration and `own_brand = false` → still valid |
| `order_lines.campaign_influencer_id` may be empty | every existing line has one; only an own-brand sale writes none |

## What is touched, and how it stays the same
| File | Change | Why existing behaviour holds |
|---|---|---|
| `services/shoppablePosts.service.js` | one resolver for "who is this post for"; own-brand branches in the brand list, the choices, the offer and product checks, send and approve; the post read joins the collaboration loosely | for a collaboration post the resolver returns the same collaboration row and every check runs the same code; the loose join returns the same columns because every such post has its collaboration |
| `services/shopperPosts.service.js` | the shop pool no longer joins the collaboration (it read nothing from it); the code lookup joins it loosely | same rows for existing posts — the join could never drop one |
| `services/orderPricing.service.js` | loads an own-brand post; its offer applies when the offer is the post's brand's; commission 0 | a collaboration post takes the same path with the same link test |
| `services/walletRead.service.js` | the sale read joins the collaboration loosely and carries `ownBrand`; the creator's lists and totals count collaboration sales only | a collaboration sale reads the same; totals for the brand already counted every line |
| `services/postLinks.service.js` | Stats adds `own_brand` and the places | additive fields |
| `services/home.service.js` | the creator's post rows join loosely; an own-brand row names the brand | same rows for collaboration posts |
| `services/otp.service.js` | one new function that sends a code **without** storing it as a sign-in code | `sendOtp` / `verifyOtp` are not edited |
| `controllers/creatorVerification.controller.js`, admin pages | the linked brand is shown | additive |
| phone Create screens, PostStatus, PostStats, Profile, sign-up, brand Profile, brand Wallet sale | own-brand readings | each keeps its present reading when the post or sale is not own-brand |

## Risks, and what answers each
- **A post with no collaboration silently approved or lost** (survey H3 trap) → the approve check
  resolves own-brand explicitly and refuses when the link is gone; tests 11 and 16.
- **Money** → an own-brand sale is followed from checkout to the brand's wallet in the test (13, 14);
  the creator's wallet is asserted untouched (15); the three shares must add to what was paid.
- **The code** → stored apart from sign-in codes; test 3 proves it cannot sign in and does not
  cancel a sign-in code.
- **Older sales reads that join the collaboration tightly** (creator earnings, commission confirm)
  → they skip an own-brand sale, which is right: there is no commission. The creator's "coming"
  count is taken from collaboration sales only, so a skipped sale never sits there.
- **Regression** → full backend compare against `backend/baseline_item20.json`; bar 0 newly failing.

## Not touched
Campaigns, sets, invitations, negotiation, agreements, shoot plans, content approval, tranches,
withdrawals, the shopper app's screens, returns, Shiprocket, subscriptions.
