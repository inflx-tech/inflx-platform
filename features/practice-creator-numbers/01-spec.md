# The practice cast gets numbers

**Asked for:** founder, 2026-09-16 — *"for all dummy accounts we don't have any data similar to
the real account… give some dummy measurements… matched to Telugu states areas and different
stats which is nano, micro… different languages, 3 to 4 niches… spread it correctly for testing."*

---

## 1. Why they were empty

Not a bug. The 22 practice creators have Instagram handles that **do not exist on Instagram**, so
the real Apify run answered `not_found` for every one of them: no profile snapshot, no metrics,
and no YouTube account at all. Two of them read `private`.

The consequence was that nothing about numbers could be tested. A brand's follower minimum, an
engagement minimum, "most followers" sorting, the nano/micro bands, a creator's eligibility for a
set — every one of those reads a number that was not there, and the platform correctly answered
"we don't know" to all of it.

## 2. What was written

Exactly the four places a real measurement writes, and nothing else:

| Table | What it gets |
|---|---|
| `creator_social_accounts` | the Instagram row flips `not_found` → `ok`; a YouTube row is created |
| `creator_social_profile_snapshots` | followers, following, posts, verified · subscribers, videos, channel views |
| `creator_social_metrics` | the current window: avg likes, comments, reel views, engagement, basis |
| `influencers` | the five mirrored columns item 3b keeps in step, plus city, niche, languages, tier, gender |

**No scrape run is invented.** `run_id` stays NULL. The rows say "measured"; they do not claim to
have been measured by something that never ran.

**Nothing marks a row as seeded.** That is the point: every filter, sort, minimum, eligibility
rule and screen must treat these creators exactly as it treats the one real scraped account.

## 3. The spread, and why each part of it

| Axis | Choice | Why |
|---|---|---|
| **Size** | 6 nano (3k–9k) · 8 micro (22k–83k) · 5 macro (160k–310k) · 3 mega (839k–1.7m) | straddles the 10,000-follower minimum in the walk: 16 pass, 6 fail |
| **Engagement** | 9.0% at the small end falling to 1.9% at the largest | real engagement falls as reach grows; straddles the 2% minimum, with Anita at 1.9% against Pooja at exactly 2.0% for the boundary case |
| **Where** | Telangana and Andhra only — 11 cities, Hyderabad heaviest | the founder's market; also gives the city filter something to bite on |
| **Niches** | fashion 8 · fitness 5 · beauty 5 · lifestyle 4 | four, as asked |
| **Languages** | Telugu 22 · English 12 · Hindi 6 · Tamil 1 | multi-language creators, so the language filter has overlap to resolve |

## 4. Every number is derived, not typed

Engagement is computed **backwards through the app's own formula** — `(likes + comments) ÷ reel
views × 100`, which is what `socialCalc.service.js` does and what the real account reads 5.1% on.
Followers set reel views set interactions set avg likes and comments. Recompute any of these
creators and the numbers do not move: worst drift across all 22 is 0.0004 of a percentage point.

## 5. The trap this nearly walked into

`social-measure` runs **every hour at :25** and picks up any account whose `profile_due_at` or
`posts_due_at` has passed. A practice handle does not exist, so a re-measure returns `not_found`
and **blanks everything seeded here** — quietly, about a week later, most likely mid-walk.

So the practice accounts are **parked**: their next check is dated 2099. They are never due, and
the sweeper cannot reach them. That is also the honest statement of the situation — there is
nothing real out there to measure.

What this cannot stop: a person pressing **"Check again"** on a practice creator. That asks for a
fresh measurement of a handle that does not exist and will blank her. Re-running the seed with
`--apply` restores her in seconds.

## 6. Scope

**In scope:** the 22 practice creators, `+917900000110` … `+917900000131`.

**Explicitly out of scope:** the real accounts. Akshaya Reddy is untouched and asserted untouched
by the script itself. Kartikeya (private) and Somepalli Anusha (not found) keep their dashes,
because those are real accounts whose real state is exactly that.

## 7. Classification

**Production data.** No code ships — the script is a tool, run by hand, against production with an
explicit go. Idempotent: run it twice, the second run changes nothing.
