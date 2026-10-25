# Production counts — 25 Oct 2026 (read-only, `prod-counts.sql`, run after the founder's go)

| What | Count |
|---|---|
| Proof links (`content_proofs.url IS NOT NULL`) | **14** — Instagram 11, YouTube 3; Facebook 0; Story screenshots 0 |
| Link shapes | `instagram.com/reel/…` 11 · `youtube.com/shorts/…` 2 · `youtu.be/…` 1 (no `/p/`, no `watch?v=`) |
| Content rows with links | 4 collaborations, posted between 1 Oct and 10 Oct 2026, **all completed** |
| Content rows by Aim | Pay for Content 1 (posted, confirmed, final paid, completed) · Pay for Sale 4 (3 posted / confirmed / completed, 1 not yet posted) |
| Pay for Sale social rows (`content_social_rows`) | 13, all package rows, all standing; 0 outside rows |
| Legacy `deliverable_stats` | **0 rows, never scraped** · legacy live links 0 — the orphan verdict holds |
| Level 1 Apify spend | Sep 2026: 47 runs, US$1.29 · Oct 2026 (to the 25th): 32 runs, **US$2.49** of the US$5 budget |
| Level 1 cost per run | IG full ≈ US$0.21 avg (max 0.58) · YT full ≈ US$0.23 avg (max 0.81) · posts-only runs ≈ US$0.09–0.11 · profile-only ≈ US$0.00 |
| Confirmed accounts for the ownership check | Instagram 27 confirmed (5 pending) · YouTube 26 confirmed |
| Level 1 posts matching a proof link (by URL shortcode / video id) | **14 of 14** (one query; the per-link listing was refused by the classifier, so not spot-checked) |

What this changes in `01-spec.md`:
- §5 gains a "today: 14 links" column. At today's volume the rule as written (daily 30 days then weekly) costs about US$1.25 in month 1 and US$0.17 a week after — affordable beside Level 1's ≈ US$3 a month, with ≈ US$0.75 headroom. The break-even where the rule alone eats the budget is ≈ 40 live links.
- P9 (zero-cost seed) matches on the URL's shortcode / video id, not `platform_post_id` (Instagram's is a numeric id, socialCalc.service.js:67). Today every link would be seeded for free.
- Two of three YouTube links are `/shorts/` URLs and one is `youtu.be` — the Step-0 probe must cover both shapes.
- Every link in production today is on a completed collaboration 15–24 days old; under either schedule they would be mid-curve when this ships. Backfilling them is a decision for the lock (trigger `backfill`, ≈ US$0.05 for all 14).
