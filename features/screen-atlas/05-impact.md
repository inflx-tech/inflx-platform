# Impact

**Deploy-inert.** No code, no migration, no runtime change. `git push` alters
nothing in production.

## What the lock changes

**Before** — the design lived in seven tab-shaped files that described the same
screen several times, plus three planning documents. There was no way to tell
whether two descriptions of one screen agreed.

**After** — one address per screen, one description per screen, and a check that
fails when they drift.

## What it unblocks

Implementation slices can begin. Each carves its own contract, names the
addresses it implements, and redraws nothing.

## What it does NOT unblock

**Nothing in the money phase can be built until the production data is repaired.**
The 16 sales rows in production are practice data — no `razorpay_payment_id`, one
practice brand, and `marketplace_fee_amount` / `brand_net` were never computed on
them. Any screen that sums them shows a wrong number. Repair or exclusion comes
before `SB-57`, `SC-32` and `SC-30`.

## The four schema decisions this lock commits to

| | Decision | What breaks without it |
|---|---|---|
| 1 | a negotiation belongs to a **set row**, not a floating agreement | BR-05, BR-06, CR-02, CR-03 cannot be built |
| 2 | a counter carries **which kind** it is — money vs structural | the brand's screen cannot know whether she stays in the set |
| 3 | `creator_posts` gains `campaign_influencer_id` | five features, including AD-03 entirely |
| 4 | live links are **a row per channel**, not a `post_url` column | the founder's per-channel rule is unbuildable |

Each is recorded on the action that forced it, with what breaks without it.

## Carried, unfixed, and known

- `cancelInfluencer` writes an invalid `campaign_influencer_status`. Confirmed live; it will
  throw the first time it runs.
- The three 30 Aug shoot fixes are live (OTA v192/v199) and **have not been
  walked on a handset**. That belongs in the end-to-end verification pass.
