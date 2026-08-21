# Where the programme actually stands — all three plans reconciled

**2026-08-20.** Reads the collaboration plan (8 phases), the follower plan (7 slices), the
merged nine-stage programme, and all twelve agreed mockups. Every claim then checked against
the code and the production database.

Companion to `Docs/MOCKUP_AUDIT_2026-08-20.md`, which covers the mockups themselves.

---

# PART 1 — The merge is sound

The two plans map onto the nine stages cleanly. Nothing was lost from the *work*.

| Stage | Comes from | Size |
|---|---|---|
| ✅ Foundations | Collab **Phase 0** | — |
| ✅ What a collaboration paid + products by kind | Collab **Phase 1** | — |
| ✅ Recording follower behaviour + post→sale link | Follower **Slice 0** | — |
| ✅ Follower profile repairs | Follower **Slice 1** | — |
| **1** A brand asks a creator, and she sees it | Collab **Phase 2 + Phase 3** | **double** |
| **2** A follower watches a post and buys | Follower **Slice 2** | single |
| **3** One link per channel, one code per post | Follower **Slice 3** | single |
| **4** A brand runs a campaign from the phone | Collab **Phase 4 + Phase 5** | **double** |
| **5** The shoot, and the content | Collab **Phase 6 + Phase 7** | **double** |
| **6** Talking — comments, hashtags, search | Follower **Slice 4** | single |
| **7** A creator who is also a brand | Follower **Slice 5** | single |
| **8** The numbers, built once | Collab **Phase 8** + Follower **Slice 7** | **double** |
| **9** A feed that learns | Follower **Slice 6** | single |

**Four of the nine stages are two original phases each.** That is not wrong — they belong
together — but the nine-stage document presents all nine as peers, and Stages 1, 4, 5 and 8
are roughly twice the size of the others. Worth knowing before sequencing.

---

# PART 2 — Six things the merge dropped

## 1 · Decision A is settled and missing from the nine-stage plan

**"Approved brands are pitchable by default."** Answered by you on 2026-08-15 and recorded in
the Phase 0 lock. It needs **one migration** flipping approved brands from unreachable to
reachable.

It is the **only outward-facing change in the whole collaboration programme** — some brands
will first notice via a pitch notification. The original plan says it deserves its own line in
the deploy note rather than riding in quietly.

**The nine-stage document does not mention it anywhere.** It belongs in Stage 1, and Stage 1's
"Pitches" half is theatre without it: **1 of 28 brands accepts pitches today.** A creator
opening "find brands to pitch" sees one restaurant.

## 2 · Decision C is still owed

Media library — extend the existing asset store, or build beside it. Deferred to collaboration
Phase 7, which is now **Stage 5**. Not recorded in the nine-stage plan.

## 3 · The device check owed on OTA v224

Profile → Saved posts → open a post — that path newly registered the post viewer inside the
Profile stack, which is the exact crash class from v93. Then delete an address, then edit a
name. **Still owed, never run.**

## 4 · Four shipped contracts are still marked unreleased

`collab-phase0-foundations`, `follower-event-log`, `follower-profile-repairs`,
`concept-stageb-discover`. This is the same rot the nine-stage plan already identified — 231 of
439 records wrong. It matters more than housekeeping here, because one of those four is
**genuinely incomplete** (see Part 3) and its wrong flag is hiding that.

## 5 · The two plans allowed parallel work; the merged one does not

The collaboration plan says Phases 1 and 2 can run alongside each other, and so can 3 and 4.
The nine stages are strictly sequential. Probably correct for testing, but it was a deliberate
choice in the original and became an accident in the merge.

## 6 · The follower app's actions are not in the 160-action ledger

The ledger covers brand and creator. Stages 2, 3, 6, 7 and 9 are follower work and have **no
equivalent governing list**. Five of the nine stages are therefore not covered by the rule
"nothing gets built that isn't a row in the ledger."

---

# PART 3 — Phase 0 is not finished

**This is the most important finding in this document.**

Phase 0 shipped on 2026-08-15 (commit `a8cf50f`, migration 152) and is recorded as complete.
It had five parts. **Three are genuinely done. Two are dead code.**

| Foundation | State |
|---|---|
| The step diary | ✅ Table exists, every ask/counter/accept writes to it |
| The creator can counter back on her own pitch | ✅ Route live on the server |
| The three corrections | ✅ Shipped |
| **One step calculation, on the server** | ❌ **Written, deployed, and never called by anything** |
| **One needs-you count, on the server** | ❌ **Same** |

`collabStep.service.js` and `collabCounts.service.js` exist and are carefully written. I
searched the entire repository: **nothing imports them.** No route, no controller, not one test.
There is no endpoint, so no app can ever ask for the number.

Phase 0's own stated final output was: *"both apps can ask the server what step a collaboration
is on and how much is owed."* **They cannot.**

**Why this matters more than it sounds.** FINAL 4 says it plainly: *"Two things must be
server-side — the step number and the needs-you count. If either is derived in the app, the
brand's screen and the creator's screen will eventually disagree about the same collaboration,
and that is the failure this whole spine exists to prevent."*

Four stages read these numbers: **1, 4, 5 and 8.** Every one of them will either be blocked, or
will quietly compute the number in the app — which is the exact failure the foundation was
built to prevent.

**The fix is small.** The calculations are done and were proven correct against production by a
one-off probe. What is missing is the routes that expose them, and something to call them.

Note the honest wording in the Phase 0 lock — *"the two calculations are endpoints nobody calls
yet."* They are not endpoints. They are services with no endpoint.

---

# PART 4 — Phase 1 is finished, and has never seen a rupee

Both items shipped and are reachable: `/me/commissions/by-campaign` and
`/me/commissions/campaign/:id` are live and use the breakdown service; product category
labels now ride on all three product surfaces plus the post composer. Released 2026-08-19,
commit `ed11b16`, creator OTA v168.

The Phase 1 lock records its own gap honestly: *"No money figure has been seen with real money
in it."*

**Confirmed, and worse than that.** Production holds **6 transactions**. **Zero** carry a
creator, a campaign or a post. Total commission across the platform: **₹0**.

So the plan text that justified Phase 1 — *"Six real attributed sales already exist in
production; the per-collaboration figures must add up to the lifetime figure"* — was false when
written. The screens are shape-correct and prove out at zero. **They cannot be functionally
tested until an attributed sale exists.**

---

# PART 5 — Three corrections to the follower plan

## 1 · The abandoned reels work has no table

The nine-stage document says: *"a database table already created for it — the table sits empty
and unused."*

**There is no table.** Migration `081_shoppable_reels_foundation.sql` exists as a file in the
repo and was **never applied to production**. No `%reel%` table exists there, and no server code
or screen was ever written.

**Killing it costs nothing** — it is a contract folder and an unapplied file. Even easier than
the plan assumed.

## 2 · Pay-at-store already has a switch, and it is ON for everyone

The follower plan says brand registration never asks about a physical shop. **Nothing writes
it — that part is right.** But `brands.pay_at_store_supported` **already exists**, it is
**true for all 28 brands**, and the follower app already reads it.

So the plan's proposed rule — *"until a brand answers, no button appears"* — is not a new
button appearing. It is **switching the button off for all 28 brands that currently show it.**
That is outward-facing and needs your decision, not a default.

There is also a design question: this flag looks like it came from the dining vertical.
Whether it is the right field to reuse for every business type is worth one look before
Stage 2 leans on it.

## 3 · Slice 0 is live but has recorded almost nothing

| | In production |
|---|---|
| Follower behaviour events recorded | **2** — one view, one impression |
| Sales linked to a post | **0** |
| Likes / saves | 0 / 0 |
| Followers on the platform | 462 |

The pipe is connected. Nothing has flowed through it. **Stage 9 (the feed that learns) needs
weeks of this data and currently has two rows** — which confirms the plan's own instinct to put
it last, and means the clock on it has not started.

---

# PART 6 — The one thing that will derail this if we don't decide it

**Almost nothing in the programme has ever been run, and you test functionally.**

| | Production |
|---|---|
| Brand→creator requests | 2, neither opened, both expire this week |
| Creator→brand pitches | 0 |
| Saved creator groups | 0 |
| Settled agreements | 0 |
| Diary entries | 0 |
| Contracts | 1 |
| Shoots | 1, stuck at "proposed" |
| Shop posts / deliverables | 1 / 1 |
| Attributed sales | 0 |
| Follower behaviour events | 2 |
| Creators who can be contacted | 29 |
| Brands that accept pitches | 1 of 28 |

Every "works today" across all twelve mockups and all three plans means *the code exists and is
wired* — not that anyone has walked it. Stage 8 has no numbers to show. Stage 9 has no
behaviour to learn from. Stage 1's test cannot be run on Vijayawada fashion creators because
there is one.

**This is a plan-level decision, not a stage-level one.** Three ways:

- **Seed a test world** up front — creators, brands, agreements, campaigns, shoots, posts,
  attributed sales. Most work, tests everything, repeatable per stage.
- **Walk it forward** — each stage's test creates what the next needs. No extra build, but one
  broken link stalls everything behind it and you cannot re-test without re-walking.
- **A mix** — seed the slow, invisible parts (sales, events, posts); walk the human parts
  (asking, negotiating, signing). **Recommended.**

---

# PART 7 — What I think we do, in order

**Step 1 · Finish Phase 0.** Expose the step number and the needs-you count as real endpoints,
and add the tests neither has. Small, server-only, safe for phones that have not updated, and
four stages are waiting on it. Nothing else should start first.

**Step 2 · Decide the test world.** Then build the seed, if that is the answer.

**Step 3 · Fold in what the merge dropped** — Decision A into Stage 1 (with its own deploy
line), Decision C into Stage 5, the owed v224 device check, and a release-status pass over the
four wrong contracts.

**Step 4 · Rewrite the nine-stage plan** with the corrected sizes: Stages 1, 4, 5 and 8 are
double, Stage 1 loses the brand pitch settings (already exist) and gains Decision A, Stage 2
gains a pay-at-store decision rather than a new build, and Stage 2's reels kill is free.

**Step 5 · Then Stage 1**, in a fresh window, against a locked plan.
