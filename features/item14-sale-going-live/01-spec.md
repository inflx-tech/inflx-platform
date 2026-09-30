# item14-sale-going-live — spec

**Item 14 of 21: Pay for Sale — going live, completion and selling.** Master business rules
**v1.29** §12.1, §13, §19, §20, §21, §24, §25, §26, §27, §28, amended by this item into **v1.30**
(items 14 and 15 only, written after the mockup lock). `Docs/OFFER_TERMS_POSTS_RULES.md` (v1.13) is
**reference only** for the built items 13 and 16 and is **not edited** by this work.

**Builds on** item 12 (`features/item12-content`: the content package, rounds, files, captions,
proofs, reports, `contentFlow`, `contentGate`, the Delayed arm and reminder lane, the storage path,
the phone's upload and content components), items 10/11 (the shoot row, `shootGate`, Delayed),
item 13 (`shoppablePosts.service.js`: posts, `postable()`, `doneCounts`, the Create tab) and item 16
(orders and the per-item money on `order_lines`).

**Item 15 (Hybrid) follows** in its own contract. It uses item 14's step unchanged and adds the
money: the brand's live confirmation releases the second 25% (`contentMoney.releaseSecond`) and
stamps the final 50%; Hybrid never confirms itself. Item 14 is built so item 15 only adds that.

## The state today (survey 30 Sep 2026, verified against the code)

1. After a Pay for Sale or Hybrid shoot, **both apps stop at "shoot done"**: no next button, no
   screen. The content step is Pay for Content only (`contentGate.service.js:119`,
   `contentFlow.service.js:109`; the phone's shoot screens show "Go to your content" only for
   `engagement`).
2. The shoot-done notice tells **every** creator "Your content step is open", whatever the Aim
   (`shootPlan.service.js:407,449`, `remoteReturn.service.js:180,184`).
3. **Nothing marks a sale collaboration Completed.** `'completed'` is written only by
   `contentMoney.releaseFinal` (Pay for Content).
4. **Minimum shoppable posts** is stamped (`campaign_influencers.min_shoppable_posts`) and counted
   (`shoppablePosts.doneCounts`), shown only on her Create tab. The brand never sees it; a
   shortfall is never flagged.
5. **No social links on posts.** No table or column holds where she shared a post.
6. **Delayed** covers sale collaborations for shoot stages only; no post-shoot stages exist.
7. Sales and commission already run whatever the collaboration's state (item 16). Item 14 moves
   **no money** for Pay for Sale.

## Founder decisions (30 Sep 2026)

| # | Question | Decision |
|---|---|---|
| D1 | Does the brand approve the social-media version before she posts (§12.1)? | **Yes.** Item 12's package and rounds are reused. |
| D2 | What does the brand confirm as live? | **Once per collaboration.** |
| D3 | Pay for Sale, brand silent after she posted | **It confirms itself** after an Admin number of days (7). Hybrid never does (item 15). |
| D4 | Social numbers (scraping) and the Performance screen | **Later (Level 5).** Item 14 collects the links; the brand opens them to confirm. |
| D5 | The return window | Already Admin-controlled and built (Settings → Payments default; Pricing → Categories per category). Not part of item 14. |

## The rules item 14 delivers (to be written into v1.30 §12.1 after the lock)

### 1 · Opening the step
- The step opens when the shoot is marked done (§11), for a Pay for Sale collaboration signed on
  the new creator terms. Collaborations signed before the new terms cannot make shoppable posts
  and are shown so, plainly.
- Both apps get a door to it from the shoot-done screen and from the collaboration row; the
  creator's Create tab keeps its "Needs a shoppable post" card.
- The shoot-done notice names the step that actually opens for the collaboration's Aim.

### 1A · Two separate paths, in order (founder, 30 Sep 2026)
- **Path 1 — the shoppable post**, checked by **INFLX** for quality: she creates it (item 13's
  flow: offer post or price post, products, theme tags, format, media, caption), sends it to INFLX,
  INFLX approves or sends it back; approved → post code and link, in the shop from the Posting Date.
- **Path 2 — the social media post**, checked by **the brand** (sections 3–5 below).
- **Path 2 is locked until INFLX has approved at least one of her shoppable posts in this
  collaboration.** Nothing can be sent to the brand before that, and only INFLX-approved posts can
  be named in Path 2. The server refuses it, not only the screen.
- Each path has its own reviewer and its own rounds; a verdict on one never changes the other
  (§13). Completed needs both: the minimum approved in Path 1 and the live confirmation in Path 2.
- "Create a shoppable post" on Going live opens item 13's create flow with the brand and this
  collaboration filled in. Item 13's screens are otherwise unchanged.
- v1.30 replaces §12.1's old post-creation steps (several brands, campaigns, concepts) with the
  post creation built in item 13.
- Noted, not changed: §13 allows INFLX two send-backs; item 13 has no limit. Left for item 13.

### 2 · Posts against the minimum
- She makes shoppable posts from the Create tab (item 13, unchanged). INFLX approves them.
- Both sides see progress: "1 of 1 approved" against the minimum stamped on the collaboration.
- A post approved after the Posting Date **still counts**; the brand sees it marked late. No
  penalty (§4.10 of the posts rules, carried into §12.1).

### 3 · The social version (D1)
- Once she has at least one approved post, she chooses **what she will share and where**: one or
  more of her approved posts, each with a destination — Instagram reel, Instagram post, Instagram
  story, YouTube video, YouTube Short, Facebook post. These rows are her **named social
  deliverables** (§12.1): at least one, as many as she likes. The brand never chooses them.
- For each row she uploads the version she will post (the same file limits as item 12: photos
  JPG/PNG ≤ 10 MB, videos MP4 ≤ 200 MB, ≤ 10 files a row) and may propose a caption (≤ 500).
- She sends all rows together as **one package**; sending locks it.
- The brand gives **one verdict**: approve, or ask for changes with a reason (≤ 500) and optional
  notes on files. The number of change requests is the Admin number item 12 uses
  (`content_change_rounds`, 2), stamped at her first sending. On the last round the brand is
  warned; beyond it the brand may only approve or report to INFLX.
- Rows can be added or removed only while the package is open to her (before sending, or after
  changes are asked).

### 4 · Posting and links
- Approval locks the package. She posts on the platforms she named and gives **a public link for
  each row**, or a **screenshot** for a Story. Links are checked for shape and platform, not
  fetched (fetching is Level 5). She marks it posted.

### 5 · Live, and Completed (D2, D3)
- The brand opens her links and **confirms it is live, once for the collaboration**.
- If the brand does not answer, it **confirms itself** after the Admin number of days (7 by
  default, a new setting, stamped when she marks it posted), unless the brand has reported it.
- The collaboration is **Completed** when both hold: confirmed live, and the minimum of approved
  posts reached. If it is confirmed before the minimum is reached it shows "Live · waiting on
  posts" and completes by itself when the minimum is reached (§19).
- **Selling carries on** after Completed (§19, §20); both sides keep seeing this collaboration's
  orders, sales and commission.

### 6 · Posts shared outside the package
- A post approved after she sent the package, or any post after Completed, needs **only its
  links**, for reporting — no brand approval.
- Every approved post should carry at least one link by **two days after the Posting Date** (or
  two days after its approval, if later). A post without one is shown to the brand as "not shared
  yet". No penalty.

### 7 · Problems
- **The brand reports** (not posted, not what was approved, missing): the step freezes — nothing
  can be sent, approved or confirmed, and it does not confirm itself — until INFLX settles it.
  **Her posts stay in the shop and keep selling** (§13: the INFLX post and the social post are
  separate). The report is recorded for item 18 (disputes).
- **Delayed:** not confirmed live by the Posting Date → flagged Delayed, both sides told once,
  nothing moves (§25). The stage follows it: *posts not approved · social version not sent · in
  review · changes asked · not posted · not confirmed*.

### 8 · Admin numbers
| Number | Default | Stamped |
|---|---|---|
| Change requests on the social version | 2 (item 12's `content_change_rounds`) | at her first sending |
| Days before a Pay for Sale live confirmation confirms itself | 7 (new) | when she marks it posted |
| Minimum shoppable posts | 1 (existing `min_shoppable_posts`) | at invitation (existing) |

### Not in item 14
Hybrid's money (item 15) · social numbers, scraping, the own-account check and the Performance
screen (Level 5) · disputes resolution screens (item 18) · Home / Needs You screens (item 19) · any
change to offers, terms, posts, links or ordering (items 13 and 16).

## Open for the gap check (after the lock)
- Whether the social package lives on `collab_content` (item 12) with rows sourced from her named
  deliverables, or on its own table sharing item 12's files/rounds/proofs.
- The Facebook post destination: item 12's platforms are Instagram and YouTube only.
- The Delayed CHECK widening and the stage refresh for sale collaborations.
- Production: how many signed sale collaborations are on the new terms (none on 29 Sep) — the walk
  waits on one with its shoot done.
