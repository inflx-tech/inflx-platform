# item21-content-posts — spec

**Item 21 of 22: Pay for Content gains shoppable posts; Entire store allocation for every Aim.**
Pay for Content keeps its fixed fee and its fixed social media deliverables and gains a fixed number of
shoppable posts in INFLX, on what the brand chooses, with no commission to the creator. Every Aim gains a
third allocation choice, Entire store, which follows the store. Survey: `00-survey/code-survey-2026-10-24.md`.
Board: `04-preview/mockups/item21-content-posts-v1.html`. Master rules written as v1.34 after the lock
(sections 7A, 11.2, 12.2, 19, 21, 22, 25). Builds on items 12, 13 (Levels 1–4), 14, 15, 20.

## Founder decisions (24 Oct 2026)
| # | Decision |
|---|---|
| D1 | The **brand sets the number** of shoppable posts on a Pay for Content invitation (1–10), beside the deliverables. **She may counter it**, like deliverables. Pay for Sale and Hybrid keep the admin minimum, locked. |
| D2 | What she posts about is chosen as for Pay for Sale: **offers and products without offers**, or Entire store. |
| D3 | **The final 50% waits for the posts.** It is released when the stamped waiting period has passed AND INFLX has approved the agreed number of posts, whichever is later. The brand's live confirmation still releases the second 25% on its own. |
| D4 | **Path 2 (the social package) is locked until INFLX approves her first shoppable post**, exactly as Pay for Sale: a social post sends people to INFLX, and without a shoppable post there is nothing to buy. |
| D5 | **No commission** on a sale through a Pay for Content post: creator share ₹0, INFLX's post-sale rate, the brand the rest. |
| D6 | **Entire store** = every offer and every product without an offer, **living**: a product listed or an offer published after signing joins the collaboration by itself. Offered for all three Aims. |

## My defaults (told to the founder with the board; stop me if any is wrong)
| # | Default |
|---|---|
| R1 | An Entire store collaboration takes an offer as soon as the offer is **published**, including one that starts later (her post for it waits for the offer's start, rule 4.1 as today). An ended offer leaves, as today. The posting-date filter applies only to what is **shown** while picking offers one by one. |
| R2 | Entire store can be sent only if the store has **at least one** published offer or one product without an offer today. |
| R3 | The brand's **End-offer warning** counts Entire store collaborations too: "in 3 unsigned invitations · also in 2 signed collaborations that sell your entire store (their posts for it will be removed)". |
| R4 | The Remote shoot parcel for Pay for Content picks from **what she posts about** (Entire store = the whole catalogue), the same rule as Pay for Sale and Hybrid. |
| R5 | A Pay for Content collaboration signed **before** this (12 in production, all old terms) keeps today's one-path step. Only invitations sent after the deploy carry posts. |
| R6 | A creator's **pitch** stays money-only; the brand adds the posts number and what she posts about when it invites her, as it adds deliverables today. |
| R7 | A **report** by the brand gains one reason for Pay for Content after the posting date: "She hasn't made her shoppable posts." Money stays locked until INFLX settles it (item 18 parked: recorded, not adjudicated). |
| R8 | New **Delayed** stage for Pay for Content: "shoppable posts not approved" (alongside item 12's five), flagged at the posting date, never punished. |
| R9 | Her post **stats** and the brand's **set Posts** list say "N sales" instead of "₹X to you" whenever the collaboration pays no commission (today only own-brand posts do). The creator's wallet and Commission list never show these sales. |
| R10 | "Use these terms for everyone" copies the posts number and the allocation (including Entire store). |

## State today (survey 24 Oct 2026 — verify each before building on it)
- Money shapes by Aim are enforced everywhere (terms, counters, pitches, agreement); Pay for Content = fee + deliverables + note + usage rights, no allocation, no posts.
- The post-creation door, the minimum stamp, Needs You, the Create tab and the agreement rows are keyed on `goal ∈ {conversion, hybrid}` (survey §2, §5).
- Allocation: offers linked, products frozen at sending; `sell_mode ∈ {none, all, chosen}`; no whole-store value.
- Pricing already gives a null commission a ₹0 creator share (item 20); the "sales" wording is keyed on the own-brand flag only.
- Production: 12 Pay for Content collaborations, all old terms; 0 posts on any of them.

## What item 21 delivers
1. **Terms** — Pay for Content invitation carries `shoppable_posts_n` (1–10, brand-set, counterable) and an
   allocation (`sell_v2`, `sell_mode`, `collab_offers`, `sell_product_ids`), validated as for selling Aims
   ("give her at least one offer or one product"). New `sell_mode = 'store'` for Entire store (all Aims).
   Invitation, counter, agreement snapshot and PDF show the rows. Pitches unchanged.
2. **Entire store resolution** — `creatorTerms.sellFor / sellableProductIds / creatorOffer` read the store
   live when `sell_mode='store'`: published offers (running or future) + products held by no offer today.
   `dropEndedOffer` / `afterProductChange` already reach her posts; `unsignedWith` and the End-offer warning
   count store-mode rows. The Create tab's offer and product pickers read the same resolver.
3. **Going live for Pay for Content** — `contentGate` lets `engagement` with `sell_v2` through the posts door;
   `contentFlow.shape` grows Path 1 (count against `shoppable_posts_n`, late flag) and the Path 2 lock
   (first approved post), reusing `saleLive.path1 / approvedCount`. Rows of Path 2 stay the agreement's
   deliverables (item 12 unchanged). `contentMoney.releaseFinal` for a posts-bearing collaboration releases
   only when due AND approved ≥ n; an approval after the due date releases on approval (same transaction
   rule as item 12: completion in the same transaction). Delayed stage `posts_not_approved`.
4. **Posts door** — `shoppablePosts.postable / myCollabs / collaborations` admit `engagement` with `sell_v2`;
   earning words "fixed fee · no commission"; `salesWords` keyed on commission 0, not own-brand.
5. **Home / Needs You** — "Create a shoppable post · 2 more for {brand} before {date}" for Pay for Content;
   brand Needs You unchanged (INFLX approves posts).
6. **Phone** — brand: terms screen (posts number, What she posts about with Entire store), summary, agreement;
   creator: invitation, counter (posts number), agreement, "What you can post about" with Entire store words,
   Going live two-path screen for Pay for Content (both sides), Create › Which collaboration, post stats.
   Website: End-offer dialog warning. Admin: nothing new.
7. **Tests** — `backend/tests/item21-content-posts.test.js` (real API + DB: send → sign → shoot done → post
   approved → package → confirm live → final held → third post approved → final released → Completed; a sale
   through her post priced at commission 0; Entire store picks up a product listed after signing); mobile
   `item21.test.js`; full backend compare vs `backend/baseline_item21.json` (bar: 0 newly failing).

## Rules the build holds to
- Pay for Content money is the fee alone: 25% at signing (unchanged), 25% at the brand's confirmation
  (unchanged), 50% at the later of the stamped date and the agreed posts approved (new). Nothing else moves.
- A sale through any post of a collaboration with no commission % pays the creator ₹0 and never reaches her
  wallet, Commission list or counts. INFLX's and the brand's shares are unchanged.
- Entire store never widens what a frozen-list collaboration may sell; the two chosen modes keep today's
  behaviour to the letter.
- An old-terms Pay for Content collaboration is never given the posts step; the server refuses, not only the screen.
- Pay for Sale and Hybrid change in one place only: the Entire store choice. Their minimum stays the admin number.
- Not in this item: a penalty for a missed count; INFLX adjudicating a brand report (item 18); the shopper app
  (nothing to change — a post is a post); admin settings (none added).
