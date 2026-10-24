# item21-content-posts — expected outputs

## Terms (brand → creator)
| Check | Expected |
|---|---|
| E1 Pay for Content invitation without a posts number | refused 422 `shoppable_posts_n` "How many shoppable posts should she make? 1 to 10." |
| E2 Pay for Content invitation with n=3 and nothing to post about | refused 422 `sell` "Give her at least one offer or one product to post about." |
| E3 Pay for Content invitation, n=3, 2 offers + all products | stored: `sell_v2=true, sell_mode='all', shoppable_posts_n=3, commission_pct=null`; `collab_offers` 2 rows; `sell_product_ids` frozen |
| E4 Entire store on any Aim | `sell_mode='store'`, `sell_product_ids='{}'`, no `collab_offers` rows; agreement words "Everything in {brand}'s store, now and later" |
| E5 Entire store when the store has no published offer and no product without an offer | refused 422 "Your store has nothing to sell yet." |
| E6 Creator counters n 3 → 2 | counter accepted as a whole-counter; brand sees "She proposes 2 shoppable posts (you asked 3)" |
| E7 Creator tries to counter the allocation | refused 422 "What you post about is the brand's to set." |
| E8 Pay for Sale invitation | unchanged: admin minimum stamped, n null; Entire store accepted as E4 |
| E9 "Use these terms for everyone" | copies n and the allocation, Entire store included |

## Entire store, after signing
| Check | Expected |
|---|---|
| E10 Brand lists a new product (no offer) | it appears in her price-post picker the same day; a frozen-list collaboration does not see it |
| E11 Brand publishes a new offer starting next month | it appears in her offer picker; a post she makes for it waits for the start date (4.1) |
| E12 Brand ends an offer | her posts for it are removed (as today); website End-offer dialog says "also in N collaborations that sell your entire store" |
| E13 Brand removes the last product of an offer / hides a product | existing hooks fire unchanged |

## Going live — Pay for Content with posts
| Check | Expected |
|---|---|
| E14 Shoot done | step opens: Path 1 "0 of 3 approved · Create a shoppable post"; Path 2 "Locked · Opens when INFLX approves your first shoppable post" |
| E15 She tries to upload the package before any approval | refused 422 `PATH2_LOCKED` (server), screen shows the lock |
| E16 INFLX approves post 1 | Path 2 opens; rows = the agreement's deliverables (2 reels, 1 story), item 12 unchanged from here to confirm |
| E17 Brand confirms live with 1 of 3 approved | second 25% released; tranche 3 queued with `release_due_at` = +7 days IST 03:00; screen "Final ₹4,000 due 31 Oct, once 2 more posts are approved" |
| E18 Due date passes, 1 of 3 approved | job does NOT release; row marked `release_held_for_posts=true`; creator Needs You "2 more posts to release ₹4,000"; brand sees "waiting on her posts" |
| E19 INFLX approves post 3 after the due date | final 50% released in the approval's transaction; `collab_content.completed_at` set; collaboration `completed`; campaign completes if all do |
| E20 INFLX approves post 3 before the due date | final releases on the due date (today's job), then Completed |
| E21 Posting date passes with 2 of 3 approved | Delayed, stage `posts_not_approved`; both told once; brand sees "2 of 3 · late"; no penalty |
| E22 Old-terms Pay for Content collaboration (sell_v2=false) | one-path step exactly as item 12; posts door 404; no Path 1 on screen |
| E23 Brand report after posting date | reason list gains "She hasn't made her shoppable posts"; step frozen; nothing moves |

## Money on a sale
| Check | Expected |
|---|---|
| E24 Shopper buys ₹2,000 through her Pay for Content post | order_lines: commission 0, commission_pct 0, platform_fee at the brand's post-sale rate, brand_net the rest; `line_split_adds_up` holds |
| E25 Her wallet / Commission list / Home Money | nothing from that sale; her post stats "1 sale · ₹2,000" (not "to you") |
| E26 Brand Wallet › Sales money | the sale listed with Creator's share ₹0 |

## Regression bar
Backend full compare vs `baseline_item21.json`: 0 newly failing. Mobile suite green. item12, item14, item15,
creator-terms-v2, shoppable-posts-v2 suites unchanged and green.
