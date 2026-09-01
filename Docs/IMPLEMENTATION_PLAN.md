# Implementation plan — brand and creator apps, stages 1–4

**Written 2026-09-01, against `features/screen-atlas` (mockup-locked the same day).**

Five stages, in the order of the five Action Books. The order is not preference —
each stage cannot work until the one before it exists.

---

## Two decisions settled at the start

**A brand who never confirms she went live.** Silence becomes confirmation after a
short, admin-set wait. She posts her link; he is nudged on day 1 and day 2; if he
has said nothing by day 3 it confirms itself and her second 25% releases.

- The number lives on `SA-04` beside the other waits.
- **She sees the countdown too** — "they have 2 days, then it confirms
  automatically". No chasing.
- **Rejecting is not free either.** After two rejections on the same channel it
  goes to admin, not back to her — otherwise "not live / wrong link" becomes the
  new way to withhold.
- Applies to **pay-for-content sets only.** On a sale set the link is a reference
  and no money hangs on it.

*Why: the risk is lopsided. A brand who auto-confirms a bad link loses a quarter
of a fee he already agreed and already locked in escrow, having had three days and
a button to stop it. A creator waiting on a button nobody must press loses money
she has earned, with no recourse. The second is worse.*

**Minimum shop posts per collaboration.** Admin decides. Already drawn that way on
`SA-04` as a number field. No design change.

---

## What already exists — checked, not assumed

Read from the migrations before sizing anything. This is materially better than
the atlas implies, and it changes what Stage A costs.

`campaign_influencers` **already carries**:

| Column | Serves |
|---|---|
| `commission_pct`, `agreed_fee` | what she earns |
| `alloc_scope`, `alloc_category`, `alloc_category_node_id`, `alloc_product_ids` | what she can sell |
| `brand_offer_id`, `offer_valid_from/until`, `offer_type`, `offer_config_json` | her offer |
| `delivery_address` | the remote shoot address |
| `window_start`, `window_end`, `post_date`, `posting_date` | her dates |
| `declined_reason`, `declined_note` | declining |
| `agreement_id` | ⚠️ the link to the floating agreement — **this is what Stage B changes** |

`campaign_sets` **already carries** `window_start/end`, `formats_json`,
`influencer_mode`, `set_budget`, and channels (migration 159).

**So `SB-30` "her terms" is largely an assembly over columns that exist**, and
`CR-09` "send your address" is a missing *screen*, not missing data.

**Next migration number is 165.** 163 and 164 were applied to production 30 Aug.

---

# Stage A · The set

**Makes the middle layer real.** Nothing else in the design can be built first.

### Migrations

| # | What it does | Risk |
|---|---|---|
| **165** | `campaign_sets` gains `goal` (the aim), `go_live_date`, `shoot_mode`, `invites_close_at` | additive, nullable |
| **166** | `campaign_influencers` gains `channels[]` and `formats_json` — **moved down** from the set. Set columns stay until Stage D | additive + backfill |
| **167** | Backfill live data: every existing set gets `go_live_date` from its `window_end` and `shoot_mode` from its contracts | **touches live rows** |

### Built

- `SB-23` campaign is two fields · `SB-24` builder with sets · `SB-25`–`SB-29` the wizard
- `SB-30` her terms — assembled from existing columns, plus channels and formats
- `SB-37` publish per set, with the wallet shortfall named and a button to fix it
- `SC-05` what she reads, showing the two things she cannot change

### You walk

Create a campaign → add two sets with different days and shoot modes → put people
in each → set terms once with one exception → publish → she accepts → both sign.

### Adjacent fix, done quietly here

`cancelInfluencer` writes an invalid contract status and will throw. One line.

### The constraint that shapes this stage

**Production holds six live signed contracts.** A campaign with no set must keep
working throughout. Every migration here is additive and nullable; nothing is
dropped. `167` is the only one that touches existing rows and it gets a dry run
inside a rolled-back transaction first.

---

# Stage B · The counter

**The biggest and riskiest single piece of work in the programme.** Done early,
while there is little live data, not late.

### Migrations

| # | What it does | Risk |
|---|---|---|
| **168** | `negotiations` gains `campaign_influencer_id`. Today a negotiation hangs off a free-floating agreement; it has to hang off **her row in a set** | **structural** |
| **169** | `negotiation_turns` gains `kind` — `money` or `structural` | additive |
| **170** | `campaign_influencers`: `set_id` becomes nullable; gains `deferred_at`, `deferred_go_live_date`, `deferred_shoot_mode` | additive |

`date_change_requests` (migration 106) is **superseded, not dropped** — the
deferred pool replaces it. Existing rows stay readable.

### Built

- `SB-38` she countered money — green card, stays in the set, cost on a real basket
- `SB-39` she countered the day or mode — red card, **no option to change the set's day**
- `SB-40` the pool, grouped by day + mode · `SB-24` pool sits under the sets
- `SB-41` which set? — where pitches and profile invites both land
- `SC-06` her counter, with the warning on the screen where she decides
- `SC-07` / `SB-20` one negotiation thread, read by both

### You walk

She asks for more money → you agree, she stays in the set. She asks for a
different day → she moves out → you build a third set from everyone who wanted
that day.

### Why `169` matters more than it looks

A money counter and a date counter are **the same shape in the data and have
opposite consequences.** Without `kind`, the brand's screen cannot know whether to
show the green card or the red one.

---

# Stage C · The shoot

**Nearly finished already.** The three bugs found on 30 August are fixed and live
(OTA v192/v199). What is missing is one screen.

### Migrations

| # | What it does | Risk |
|---|---|---|
| **171** | `influencers` gains `default_ship_address` | additive |

`delivery_address` already exists on `campaign_influencers`. `brand_completed_at`
and `influencer_completed_at` were added by 164.

### Built

- `SC-12` send your address · `SC-39` her saved address, with who can see it
- `SB-47` his side reads it and cannot enter tracking before it arrives
- `SB-46` / `SC-10` the store visit, both marks, waiting-on-the-other-side state

### You walk

A store visit that only closes when you *both* mark it. A remote shoot that starts
with her address and that only she can close.

### Carried into this stage

**The 30 August fixes have never been walked on a handset.** They are proved by
tests and by production data, not by a thumb. This stage is where that happens.

---

# Stage D · The content

**Blocked on one missing column** that also blocks four other things.

### Migrations

| # | What it does | Risk |
|---|---|---|
| **172** | `creator_posts` gains `campaign_influencer_id` | additive — **unblocks 5 features** |
| **173** | New table: one row per agreed channel — link, posted, confirmed, confirmed-by, rejection count | new table |
| **174** | New table: admin settings — min shop posts, return window, final-payment wait, **confirm deadline** | new table |

**`173` is a table, not a column.** One `post_url` makes the per-channel rule
unbuildable, which is the point you made and it is a schema decision, not a screen
one.

**`174` stamps its values onto the contract at signing.** A rule changed under a
signed contract is a broken contract.

### Built

- `SC-22`–`SC-24` scope first, products second · `SC-26` sent back, with days left
- `SA-01` queue ordered by nearest go-live day · `SA-02` machine checks price and allocation
- `SC-16` / `SB-50` go live per channel, confirm per channel
- **The auto-confirm job** — nudge day 1 and 2, confirm on day 3, release tranche 2
- `SA-04` the four numbers

### You walk

She builds a shop post scoped to one campaign → admin reviews → sends it back →
she fixes it → everyone goes live on the same day → one link per channel → you
confirm each → and if you do nothing, it confirms itself and you see that it did.

---

# Stage E · The money

**Cannot start until the production data is repaired.**

### Prerequisite, before any migration

**The 16 sales rows in production are practice data** — no `razorpay_payment_id`,
one practice brand, and `marketplace_fee_amount` / `brand_net` were never computed.
Any screen that sums them shows a wrong number.

Repair or exclude them first, with a dry run. **This is a decision for you**:
recompute the missing fields, or mark them as practice and exclude them from every
total. Excluding is safer and I would recommend it.

### Migrations

| # | What it does | Risk |
|---|---|---|
| **175** | `brand_withdrawals` gains what the queue needs to show it — the table exists with zero rows and no screen at either end | additive |

Escrow needs no schema. It needs to **run**.

### Built

- `SB-52` two cards that are never added together · `SB-53` inside escrow, by creator
- `SB-55` / `SC-34` withdraw — **`SC-34` is the destination her Home button already points at**
- `SC-29` two numbers, never one · `SC-33` a returned sale explained
- `SA-03` one queue, both kinds, one rule

### You walk

See what escrow is holding and why. She withdraws. You withdraw sales money. Admin
approves both.

### The thing to know

**None of this has ever run.** `escrow_entries`, `wallet_transactions`,
`influencer_withdrawals` and `brand_withdrawals` are all at zero rows. The first
campaign that completes will exercise all of it at once — which is the argument for
building Stage E **before** that happens rather than after.

---

# The migrations, in one list

| # | Stage | What | Touches live rows |
|---|---|---|---|
| 165 | A | set gains aim, go-live day, shoot mode, invites close | no |
| 166 | A | channels + formats move down to the creator | no |
| 167 | A | **backfill existing sets** | **yes** |
| 168 | B | **negotiation hangs off her set row** | **yes** |
| 169 | B | a counter carries its kind | no |
| 170 | B | the deferred pool | no |
| 171 | C | her saved shipping address | no |
| 172 | D | **a shop post names its collaboration** | no |
| 173 | D | one row per agreed channel | no |
| 174 | D | admin settings | no |
| 175 | E | brand withdrawals surface | no |

**Three touch live rows.** Each gets a `--dry` run inside a rolled-back transaction
before it is applied, the way 163 and 164 went in.

---

# How each stage runs

1. **Carve the contract.** Names the screen addresses (`SB-30`, `SC-16`) and the
   actions (`BR-10`, `CR-15`) it completes. Draws nothing — points at the atlas.
2. **Write the migration, dry-run it against production** inside a transaction
   that is rolled back. See exactly what it would do before it does it.
3. **Build it, with checks written to bite.** Every check deliberately broken
   first to prove it catches something.
4. **Prove no regression.** Full run, every failure classified, never claimed
   green.
5. **You give the go**, then deploy — push for backend and web, OTA for the phone
   — and you walk the stage and classify what you find.

---

# The three risks worth naming

**Production is the only environment, and it has live contracts in it.** Six
signed, Asha among them. Every migration is additive; the three that touch live
rows are dry-run first; a campaign with no set keeps working throughout Stage A.

**Migration 168 is the one to be careful with.** Moving a negotiation from a
floating agreement to a set row is the largest structural change here, and four
actions depend on it. It is early in the plan deliberately — there is less live
data to move now than there will be later.

**Stage E is a first run, not a change.** Everything else in this plan modifies
something that works. Stage E turns on machinery that has never executed, and the
alternative to building it deliberately is discovering it during someone's first
real payout.
