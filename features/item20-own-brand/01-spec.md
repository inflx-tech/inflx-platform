# item20-own-brand — spec

**Item 20 of 21: a creator who owns a brand.** A person who runs a store and also makes content for it
links the two accounts once, then posts for his own store with no campaign, invitation, agreement,
shoot plan or commission. Survey: `00-survey/code-survey-2026-10-10.md`. Board:
`04-preview/mockups/item20-own-brand-v2.html` (L1–L6, B1–B3, C1–C5, S1–S3, M1–M2). Master rules §2 is
written to match as v1.33. Builds on items 2–19; supersedes the August "dual role" notes where they differ.

## Founder decisions (10 Oct 2026)
| # | Decision |
|---|---|
| O1 | Linking lives in the **creator app**: one question, "Do you run a brand on INFLX?", as a third step of creator sign-up and later from a Profile row. A brand is **never picked from a list**. |
| O2 | The number he signed in with also has a brand account → **one tap** links it. A brand on another number → he enters the brand's number and the **code sent to it**. No brand yet → he registers it in the Brand app first. |
| O3 | The **brand is told** at once and can **remove** the link; he can remove it too. |
| O4 | For his own brand he posts **straight from Create**: pick the brand, no collaboration. **INFLX approves** each post as usual; the brand approves nothing. |
| O5 | He may sell **any running offer** of his store; a price post carries **listed products that are not in an offer** (today's rule, D1). |
| O6 | **No creator commission.** INFLX's usual share applies. The rest goes to the **brand's wallet after the return window**. |
| O7 | He stays a **normal creator for other brands** (invitations, agreements, commission as usual). |
| O8 | **One brand per creator** to start. |
| O9 | A brand may have **more than one** linked creator (in-house staff), each by the brand's own code. |
| O10 | Link removed → **live posts stay**; new ones stop (a draft or a post in review can go no further). |
| O11 | The brand sees these sales in **Wallet › Sales money** as "Your own post". An "our own posts" list on the brand side is later. |
| O12 | **Where he shared it**: on each approved own-brand post he records the place (six) and its link. **Nobody approves it.** A story needs no link (D2). Own-brand posts only (D3). |
| O13 | Creators already on INFLX get **no pop-up**, only the Profile row (D4). |
| O14 | **Linked creators** is on the brand phone only; the website shows the notice (D5). |

## State today (survey 10 Oct 2026 — verify each before building on it)
- Nothing links a creator to a brand. One number may hold a brand account and a creator account
  (`users_phone_role_key`); login is phone + code, per role.
- Every new shoppable post requires a signed, shot collaboration: a database rule
  (`creator_posts_v2_shape`), `order_lines.campaign_influencer_id NOT NULL`, and INNER JOINs in the
  post reads, the shop pool, the code lookup, pricing, the wallet's sales list and Home (survey H1–H13).
- What he may sell and the commission come from the collaboration (`collab_offers`,
  `sell_product_ids`, `commission_pct`).
- A code sent to a number is a sign-in code (`otp_codes` has no purpose).
- Stats are per post per channel; nothing is read from the social networks.

## What item 20 delivers
1. **The link** — `creator_brand_links` (one live link per creator; many per brand).
   Creator: `GET /influencers/me/brand-link`, `POST …/brand-link/same-number`,
   `POST …/brand-link/code` (send), `POST …/brand-link/code/confirm`, `DELETE …/brand-link`.
   Brand: `GET /brands/me/linked-creators`, `DELETE /brands/me/linked-creators/:influencerId`.
   None needs an approved account (linking is identity, like Change number).
   The code is stored apart from sign-in codes: it cannot sign anyone in and does not cancel a
   sign-in code in flight. Five wrong codes end the try; five sends a day per creator, three an hour
   per brand number; the try lasts 15 minutes.
2. **Own-brand posts** — `creator_posts.own_brand`. A post is for a collaboration **or** for his
   linked brand, never both. Create: his brand is first in "Which brand is this post for?"; picking
   it skips "Which collaboration?" (seven steps). Offers = the brand's published offers not ended;
   price products = the brand's listed products held by no offer today. Sending, INFLX approval,
   code, links, the shop, leaving the shop: unchanged. To post he must be linked, and the brand approved.
3. **Money** — the sale is priced with commission 0; INFLX's share is the brand's usual rate; the
   brand's share settles as every sale does. The creator's wallet, Commission list and counts never
   include an own-brand sale. The brand's Sales money shows "Your own post" and three lines.
4. **Where he shared it** — `post_share_places` (post, place, link, day). Add / change / remove on an
   approved or live own-brand post. Stats lists the places under their channel; the third number is
   sales for an own-brand post.
5. **Notices** — brand: "{Name} linked his creator account" → Linked creators. Creator: "{Brand}
   removed your link" → My brand.
6. **Words** — every line that says "collaboration", "to you", "you earned" or "Creator's share" has an
   own-brand reading (survey §6). INFLX admin: the post reads "For {brand} · own brand"; the creator's
   review card shows the linked brand.

## Rules the build holds to
- A brand is linked only by its own number: the same number as the creator's session, or the code.
- A link stores ids. Changing either number later does not break it.
- An own-brand post never earns commission, whatever the brand's collaborations with him say. While
  he is linked, the brand shows once in the brand picker, as his own.
- Numbers on any screen are per post per channel. No number is drawn against one reel.
- Not in this item: an "our own posts" list for the brand; more than one brand per creator; his
  store's products straight into a product collection; anything read from Instagram or YouTube.
