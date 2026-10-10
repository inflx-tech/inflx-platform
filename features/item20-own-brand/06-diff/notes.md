# item20-own-brand — built against the locked board (v2), 10 Oct 2026

Board: `04-preview/mockups/item20-own-brand-v2.html` — L1–L6, B1–B3, C1–C5, S1–S3, M1–M2.
Every screen was built from the screen it extends, in that screen's own components.

## Screen by screen
| Board | Built as | Same as drawn? |
|---|---|---|
| L1 same number | step 3 of `InfluencerRegisterScreen` → `BrandLinkFlow` stage `same` | Yes. Title, "This number also has a brand account.", the brand's card with its own approval chip, the grey line, **Yes, link my brand**, **Not now**. Three-bar stepper; step 1 now says "Three quick steps". |
| L2 no brand on this number | stage `ask` | Yes. Two cards, **Continue** (off until one is picked). "No" goes straight in. |
| L3 the brand's number | stage `number` | Yes. `+91` field, **Send code**, the "No brand on INFLX yet?" line. The server's "No brand on INFLX uses this number." shows under the field. |
| L4 the code | stage `code` | Yes — the six boxes, resend countdown and blue note are Change number's own pieces (now exported from that screen). **Link my brand**. A try that has ended shows the server's sentence and **Start again**. |
| L5 Profile row | `ProfileScreen` | Yes. "My brand" between Invitation settings and Legal: the brand's name + a "Linked" chip, or "Do you run a brand on INFLX?". Never one of the "things left". |
| L6 My brand | `MyBrandScreen` (new) | Yes. Card, Linked on, "Your posts for it", what he can do, **Create a post**, **Remove link** (asks first), the one-brand line. A brand under review shows the blue note in place of the grey box and no "Create a post". |
| B1 the notice | `ownBrand.service` → the brand's notices list (item 19) | Yes in behaviour. The words are "**{Name} linked a creator account**" — the board's "linked his creator account" assumed a man; the server does not know. A tap opens Linked creators. |
| B2 Linked creators | `BrandLinkedCreatorsScreen` (new) + a row in `BrandProfileScreen` after Pitch settings | Yes. Built from Blocked creators' own row. The Profile row's line counts them ("2 people post for your brand"). |
| B3 remove | `ConfirmSheet` (danger) | Yes. Body reads "Their live posts for your brand stay live. They can't make new ones, and they are told." (the same neutral wording). |
| C1 Create | `CreateHomeScreen` | Yes. The card opens on the link alone. The card's second line is unchanged ("Brand, collaboration, offer or price, media") — the board shortened it; the existing line is true for his other brands and was left. With no posts: "No posts yet. Make your first one for {brand}." |
| C2 step 1 | `PostBrandScreen` | Yes. His brand first, a purple "Your brand" tag, "Anything your store sells. No collaboration needed." Picking it shows "Step 1 of 7"; **Next** makes the post and goes to "What kind of post?". |
| C3 step 2 | `PostTypeScreen` | Yes. "Step 2 of 7"; "N offers running in your store"; "N products without offers". |
| C4 Review | `PostReviewScreen` | Yes. "For" reads "{brand} · your brand" (the server sends the line). |
| C5 With INFLX | `PostStatusScreen` | Yes. "INFLX. We check the products and offer are from your store…"; "As soon as INFLX approves it."; no last-day line; the foot line is the brand and "your brand". |
| S1 the live post | `PostStatusScreen` + `PlacesCard20` (new) | Yes. "N sales · ₹sold" in place of "to you". The card lists each place, its link and day; **+ Add a place**. |
| S2 add a place | the card's own sheet | Yes. Six chips, the link field ("Link (optional)" for a story), the hint naming the site, **Save**. Tapping a place opens the same sheet to change it, with **Remove this place**. |
| S3 Stats | `PostStatsScreen` | Yes. visits · orders · **sales**; each place under its channel as "Reel · 8 Oct"; the "In INFLX" line without "You earn…". A channel he shared on with no visit yet shows at 0. |
| M1 Sales money | `BrandWalletSalesScreen` (`copy17.whoseBrand`) | Yes. "Your own post {code} · …". |
| M2 a sale | `BrandWalletSaleScreen` | Yes. Three lines; no "Creator's share". |

## Decisions taken in the build (none changes a locked screen)
1. **A post is tied to the brand, not to a hidden collaboration.** `creator_posts.own_brand`; the post
   rule in the database now reads "a collaboration or own brand, never both". A hidden collaboration
   would have appeared in Collabs, Needs you, signed counts and offer locks (survey §3).
2. **The link code is kept apart from sign-in codes** (`brand_link_codes`). It cannot sign in to the
   brand and does not cancel a sign-in code already sent to that number. Limits: five wrong codes,
   fifteen minutes, five sends a day per creator, three an hour to one brand number.
3. **Typing his own number at L3 links at once** — it is the same-number case; no code is sent.
4. **While he is linked, that brand shows once in the brand picker, as his own.** A collaboration he
   also has with it is not offered there (an own-brand post never earns commission, O6). Posts that
   collaboration still owes can be started from the Create tab's "Needs a shoppable post" row, as today.
5. **"Link a different brand"** is offered in Profile › My brand when a brand sits on his own number
   but is not the one he means. Sign-up has "Not now" in its place, as drawn.
6. **"Create a post" on My brand needs both approvals** (his own and the brand's), because the Create
   tab is locked until his account is approved.
7. **Price posts use "held by no offer today"** — the offer builder's own reading of "products
   without offers" (D1). A product booked into an offer that starts later is free until that day.
8. **Places can be changed or removed at any time; added only once INFLX has approved the post.** On a
   removed post the record stays, read-only. Up to 20 places a post. The day shown is the day he
   added it (India time).
9. **A link typed without "https://" is accepted** and stored with it; the site must match the place.
10. **The creator's wallet reads collaboration sales only**, so an own-brand sale can never sit in his
    "coming" count (the nightly commission job skips such a sale: there is nothing to confirm).
11. **Website:** Wallet and Orders say "Your own post" / "from your own post" and drop the creator's
    share for such a sale; Settings › Profile gains a "Linked creators are managed in the INFLX Brand
    app" card (D5). The replacement-parcel line on Orders still names the creator — left as it is.
12. **INFLX admin:** the post queue reads "For {brand} · own brand (the creator is linked to this
    brand)"; the creator-review row shows "Linked to the brand: {name}"; Money › Sales marks "own post".

## Caught by the full compare, and fixed in the code
- The first full run showed **one newly failing test**: `offer-delete.test.js` — "deleted_at on an
  offer is read in offerLife, the brand's offer choices and the last-offer hint — nowhere else". The
  new "offers of his own store" read had filtered on the deleted mark. That guard is right: only the
  brand's own lists may read the mark, so that everything a creator, shopper, order or wallet reads
  of a deleted offer stays intact. The filter was also redundant — only an ended offer can be
  deleted, and an ended offer is already left out. **The filter was removed from the code; the test
  was not touched.** The full run was repeated after the fix.

## Assertion drift (older tests moved to the locked decisions)
- `screens/brand/__tests__/boardCBrandSetup.test.js`: the count of brand screens 30 → 31
  (`BrandLinkedCreatorsScreen` is new, and is scanned like the rest).
- `components/social/copy3b.js` step-1 line "Two quick steps…" → "Three quick steps…" (no test
  asserted the old sentence).

## Not in this item (as locked)
An "our own posts" list on the brand side; more than one brand per creator; his store's products
straight into a product collection; anything read from Instagram or YouTube.
