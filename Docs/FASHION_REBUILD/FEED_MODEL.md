# Follower Feed Model — functional specification (proposed)

**Status:** PROPOSED · 2026-07-23 · discussion with founder, no code
**Reads with:** POST_CONCEPT_MODEL.md · POST_CONCEPT_BUILD_PLAN.md
**Scope:** what a follower sees in the Posts tab, the Videos tab, and inside a concept feed after tapping a Discover banner — and how it becomes personal, Instagram-style.

---

## 1. Two kinds of feeds, one brain

| | Scoped feed (banner tap) | Open feed (Posts / Videos tab) |
|---|---|---|
| WHAT shows | Fixed — only posts under that concept | The system decides everything |
| Order | Personalised | Personalised |
| Job | "Show me winter jeans" — obey, then order well | "Entertain me / inspire me" — choose AND order |

Same scoring brain for both; the scoped feed just locks the topic first.

**Non-negotiable filters that run before ANY ranking, always:** post is admin-approved · post is still eligible (≥1 attached product still qualifies — the live "promise" test) · not already shown to this follower recently · (scoped feed only) belongs to the concept.

## 2. The ingredients (signals)

**About the follower:** creators they follow · location · segment/gender they browse · categories they linger on, tap, save, buy · price bands of what they view and buy · creators they repeatedly engage · brands they buy · what they scroll past fast (negative).

**About the post:** how new it is · engagement rate (likes, saves, shop-opens per view — quality, not raw volume) · sales it produced · creator's track record (fame + past performance + follower count) · creator's city.

**Between them (the personal part):** does the follower follow this creator · category affinity · price-band affinity · creator affinity · brand affinity · distance.

Availability by phase: P3 = recency, follows, location only. P4 adds section taps, sales, creator stats. P7 adds per-post views/dwell/likes/saves/shop-opens/skips — the full Instagram-style loop.

## 3. The kitchen — four steps every time a feed is served

**Step 1 — GATHER from buckets** (each bucket answers a different "why am I seeing this"):
FOLLOWING (new posts from followed creators) · NEARBY (creators/brands around the follower's city) · TRENDING (high engagement-rate platform/city-wide) · FRESH (newest from everyone incl. unknowns) · TASTE (matches learned category/price/brand affinities — P7) · SIMILAR-PEOPLE (what lookalike followers engaged — P7, optional later).

**Step 2 — SCORE each candidate:** personal relevance (biggest) + quality (engagement rate + creator track record) + freshness (new posts get a temporary boost that decays over days) + nearness. New-post cold start: no stats yet → ride freshness boost + creator's track record, then own performance takes over.

**Step 3 — MIX with editorial rules** (scores alone make feeds boring/samey):
- No two consecutive posts from the same creator; brand caps per page.
- Bucket quotas, roughly: ~40% following, ~20% nearby, ~15% trending, ~15% taste, ~10% fresh/discovery (tunable knobs, admin-adjustable).
- Exploration slots: a guaranteed small share for new creators/new posts with no history — prevents rich-get-richer, gives every creator a fair first audience.
- Category variety: don't stack 4 jeans posts in a row even if jeans-lover (scoped feeds exempt — topic was requested).

**Step 4 — SERVE and REMEMBER:** infinite pages · already-shown memory (days-scale) so the feed doesn't repeat · record everything the follower does → back into Step 2 next time.

## 4. The learning loop (P7)

Strong→weak signals: bought > shop-opened > saved > followed-after-seeing > liked > lingered > viewed. Negative: fast-skip repeatedly → that category/creator cools down.
Each action nudges affinities up/down. Recent behaviour outweighs old (tastes change). All implicit — no interest quiz required (optional 3-tap gender/segment onboarding is the only explicit ask, worth having for day-1 cold start).

## 5. Special cases

- **Brand-new follower:** location + trending + wide variety; learns within the first session from taps/dwell; optional onboarding picker (Women/Men/Kids) sharpens day 1.
- **New creator:** exploration slots guarantee first exposure; early engagement rate then speaks for itself.
- **Thin city:** location is a boost, never a wall, in open feeds — feed fills nationally, nearby wins ties (consistent with existing world-rules "never empty" philosophy).
- **Videos tab:** same brain; watch-time/completion becomes the strongest quality signal; skip-within-2s the strongest negative.
- **Scoped (banner) feed order:** followed creators first → then engagement-rate high → nearby → fresh; variety rule applies to creators, not categories.

## 6. Rollout by phase (matches POST_CONCEPT_BUILD_PLAN)

- **P3:** Posts tab = approved+eligible, newest-first, followed-creators pinned above. Honest, not smart.
- **P4:** buckets FOLLOWING/NEARBY/TRENDING/FRESH + mixing rules + already-shown memory + banner-feed ranking. Feels alive, not yet personal.
- **P7:** per-post event stream → affinities → TASTE bucket + exploration + negative signals + video watch-time. Feels like Instagram.

Admin keeps knobs: bucket quotas, freshness boost length, exploration share — tunable without code.
