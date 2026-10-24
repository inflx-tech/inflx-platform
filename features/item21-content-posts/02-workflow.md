# item21-content-posts — workflow

Discussion (24 Oct: his brief "pay for content … add fixed number of shoppable posts … no commission";
my three-part explanation; four decisions, 1–3 accepted as recommended, 4 corrected to "lock Path 2 for the
same reason as Pay for Sale"; Entire store asked for, living) → code survey (`00-survey/`) → **board v1**
(`04-preview/mockups/item21-content-posts-v1.html`, decisions D1–D6 + defaults R1–R10) → **founder lock**
→ master rules v1.34 (7A, 11.2, 12.2, 19, 21, 22, 25) → impact (`05-impact.md`; baseline
`backend/baseline_item21.json` = full run on an untouched copy of HEAD) → build:

1. migration 209 — `campaign_influencers.shoppable_posts_n smallint` (1–10, null = admin minimum / not
   applicable); `sell_mode` CHECK gains `'store'`; `collab_content` Delayed CHECK gains `posts_not_approved`;
   `escrow_entries.release_held_for_posts boolean` (so the job can say why a due row did not release);
2. terms: validator (engagement needs n + sell), invitation send (store mode, n), counter (n), agreement snapshot + PDF rows;
3. Entire store resolver in `creatorTerms` + End-offer warning + Create pickers;
4. posts door, earning/sales words, Home rows;
5. going live: contentGate, contentFlow.shape Path 1 + lock, contentMoney.releaseFinal hold, contentJobs, Delayed stage, brand report reason;
6. phone screens (brand terms, creator invitation/counter/agreement/sell words, Going live ×2, Create collab row, stats); website End-offer dialog;
7. tests (backend item21 + mobile item21; full compare; whole phone suite)

→ **explicit go** → migration 209 on production → push → OTA influencer, then brand.
