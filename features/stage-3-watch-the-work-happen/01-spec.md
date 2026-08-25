# Stage 3 — Both sides watch the work happen

**Contract:** `features/stage-3-watch-the-work-happen/`
**Plan:** `Docs/THE_PLAN.md`, Stage 3 of 11. Stages 0, 1 and 2 shipped.
**Drawn from:** `features/brand-mobile-spine/04-preview/mockups/final-4-drilldown.html` (FINAL 4)
and `features/collab-navigation-spine/03-action-ledger.html`.
**Written:** 2026-08-26, before any code.

---

## 1. What both sides will be able to do afterwards

**The brand:** tap a campaign, see its sets; tap a set, see its creators; tap a creator, see
her six steps; tap a step, do the thing. Work owed adds up at every level, and **every badge
equals exactly what is underneath it** — tap a 6 and you can walk it down to a button.

**The creator:** the same six steps, with the same numbers. When you ring her and say
*"we're stuck on step 3"*, you are both looking at the same thing.

---

## 2. Reality check — read from the code and from production, 2026-08-26

### 2.1 The foundation is built, connected, and **correct** — and nothing renders it

Stage 0 wired the two server-side numbers. I did not take that on trust; I ran the real
`collabCounts.forBrand` against **production**, read-only:

```
=== Kanchi Silks (practice) — total 8 (creators tab 3) ===
  CAMPAIGN Festive Season 2026: own=0 total=3
    SET Sarees: own=2 total=2
      Asha M.:  own=0 step=3 turn=nobody
      Meera S.: own=0 step=4 turn=creator
    SET Reels: own=0 total=1
      Nisha P.: own=1 step=4 turn=brand
      Ravi K.:  own=0 step=3 turn=nobody
    -> reconciles? YES  (0 own + 3 beneath = 3, badge says 3)
  CAMPAIGN Monsoon Cottons: own=0 total=2
    SET Cottons: own=2 total=2
      Divya T.: own=0 step=2 turn=creator
      Sneha R.: own=0 step=6 turn=nobody
    -> reconciles? YES  (0 own + 2 beneath = 2, badge says 2)
  -> tab badge 8 vs 5 campaigns + 3 creators tab = 8
```

**The whole ladder FINAL 4 draws already exists on the server, already carries a step and a
turn per creator, and already reconciles at every level.** Stage 3 is overwhelmingly a
screen job.

### 2.2 …and the brand app throws it away

| Item | Verdict | Evidence |
|---|---|---|
| `GET /brands/me/inbox-summary` returns the whole `needs_you` tree | **EXISTS** | `brandInbox.controller.js:190` |
| The brand app calls that endpoint | **EXISTS** | `BrandHomeScreen.js:83`, `BrandActionRequiredScreen.js:65` |
| The brand app **reads `needs_you`** | **NO** | grep for `needs_you` across the whole app: **zero hits**. Fetched every time, discarded every time |
| A badge on a campaign row | **MISSING** | nothing in `BrandCampaignListScreen` |
| Campaign → sets, with badges | **PART** | `BrandCampaignSetsListScreen` exists, read-only, no badge, no step |
| Set → creators, with step + turn | **PART** | `BrandCampaignInfluencersListScreen` exists; rows carry `ci.status`, never a step |
| **The brand's per-creator six-step spine** | **MISSING** | no screen anywhere. Grep for a step number across `screens/brand/`: the only hit is Stage 2's wizard rail, which is a different thing |

### 2.3 The creator has TWO step models, and the visible one is broken

| Item | Verdict | Evidence |
|---|---|---|
| `GET /influencers/me/needs-you` | **EXISTS** | `influencer.controller.getNeedsYou` — returns `total`, `items`, and `collaborations` (step per collaboration) |
| The creator app calls it | **EXISTS** | `InfluencerNavigator.js:154` |
| It uses `total` | **YES** — for the tab-bar badge | `:196` |
| It uses `collaborations` | **NO** | the per-collaboration step is fetched and discarded |
| Her collaboration detail shows a spine | **YES — its own** | `CollabDetailScreen.js:90` → `collabDetailModel.spineFor(record.stage)` |

**The two models do not agree, and one of them is wrong.**

* The server's six (`collabStep.service`): **Agree · Sign · Shoot · Shop posts · Go live ·
  Complete** — the agreed spine.
* The creator app's six (`collabDetailModel.SPINE`): **Invite · Nego · Sign · Active · Track
  · Done** — the *old* model. Three of those words are not steps in the agreed spine at all.

**And it is worse than a disagreement.** `spineFor` matches on stage names. Stage 1 renamed
the stages to `invitations · pitches · to_sign · shoot · content · done`, but `SPINE` still
expects `invites · applied · negotiating · to_sign · active · tracking · completed`. The two
lists overlap in **exactly one value**, `to_sign`. For every other stage `findIndex` returns
`-1`, so **every node renders `todo` and no current step is highlighted at all.**

This is precisely the shape of Stage 1 bug #9 — *"the stage names were renamed and the row
was never updated"* — and it is live right now. Stage 3 removes the second model rather than
repairing it.

### 2.4 What the roll-up does NOT yet count

Read line by line from `collabCounts.service.js:95–175`.

| Level | Board says it should count | Today |
|---|---|---|
| Creator step | answer a counter · slot · shortfall · countersign · approve a reel · confirm live | **derived and counted** via `stepForCollaboration` + `owes()` |
| Set | offer expiring · creator with no allocation · empty set · everything out of stock | **only "creator with no allocation"** |
| Campaign | wallet short · never published · 30 days of zero sales | **none — `camp.own` is hardcoded 0** |

The 2 showing on *Sarees* and on *Cottons* above are creators with no allocation. Real, and
correct.

**One stale comment, corrected here.** The service says an expiring offer *"cannot be
computed until offers gain an expiry"*, verified 2026-08-15. That is no longer true:
`campaign_influencers.offer_valid_until` (migration 148) and `brand_offers.store_ends_at`
both exist. Checked against production: **0 of 6 collaborations and 0 of 1 offers carry
one**, because nothing writes them — and per the Stage 2 correction, the phone's offer
builder cannot set an expiry at all. So it is now *computable and always zero*, which is a
different statement and needs a different fix. See §4.

### 2.5 What there is to look at

Production, read-only: **2 campaigns · 3 sets · 6 collaborations**, at statuses
`invited · contracted · active · active · active · completed`; 1 deliverable submitted;
3 shop posts. Enough to walk the whole ladder with more than one shape in it.

**But not one contract is signed** — `contract_signed_at` and `brand_signed_at` are NULL on
all six, including the ones marked `active`. The step derivation reads
`contractSignedByBoth` from the contract's own status, not those columns, so this does not
break it — but a brand looking at step 2 for a creator marked "active" will reasonably ask
why. Worth knowing before the walk.

---

## 3. What changes

1. **Every campaign row carries a number**, and it is the sum of everything inside it.
2. **Tap it and it decomposes** — campaign → sets → creators → the six steps → the thing
   itself. Every level shows what is owed *at that level* above what is owed beneath it, so
   a badge never hides where its number came from.
3. **The brand gets a per-creator spine** — six steps, each showing whose it is. Only the
   brand's steps carry a button; a step that is not theirs still shows its state and says so.
4. **The creator's spine becomes the same six steps, from the same source** — and the broken
   client-side derivation that currently highlights nothing is deleted, not repaired.
5. **Campaign-level and set-level owed items get counted** so the numbers reconcile against
   what the board promises, not just against themselves.
6. **Home's "needs you" list becomes the flat version of the same tree** — for clearing work
   rather than exploring it — with every row deep-linking to the thing itself.

---

## 4. What we are NOT doing

| Not this | Why |
|---|---|
| Building the shoot screen, or the content-live ordering | Stages 4 and 5. Stage 3 **links** to what already exists at level 5 and leaves gaps visible where nothing does yet |
| Adding an expiry to offers | It is a **Stage 2 punch-list item** (§2.4). Until it lands, the set-level "offer expiring" count is honestly zero rather than invented |
| Open-group sets | Out of scope since Stage 2, and still defective per `D-3`/`D-4` of the test plan |
| A new endpoint for the tree | It already exists on `inbox-summary`. A second door to the same answer is how two badges start disagreeing |
| Changing what a step MEANS | `collabStep.service` is the agreed spine and is not being redesigned. Stage 3 renders it |
| Brand web | Phones first, by the founder's standing instruction |

---

## 5. Decisions this stage has to make, and my answer

### 5.1 Repair the creator's spine, or delete it?

**Delete it.** `collabDetailModel.SPINE` and `spineFor` are a second step model that already
disagrees with the server's and currently highlights nothing. Repairing it means keeping two
derivations in step forever — the fault this programme has fixed five times now. The
creator's detail screen reads `collaborations[]` from `/influencers/me/needs-you`, the same
array the brand's tree is built from.

**The cost, stated:** her spine then needs a network call where it used to be pure. Mitigated
by the navigator already making that call for the badge — the result gets shared rather than
re-fetched.

### 5.2 Where do the missing owed-items live?

Three campaign-level and three set-level items are uncounted (§2.4). They could go in the
screens, or in `collabCounts`.

**In `collabCounts`, all of them.** The rule the service opens with is *"a node's count is
everything beneath it plus anything owed at that node itself"*. An item counted in a screen
is invisible to the roll-up, so the badge above it would be wrong — which is the one failure
the whole spine exists to prevent.

### 5.3 Does the brand's spine screen belong in the Campaigns stack or the Creators stack?

**Campaigns.** The board's ladder is `Campaigns › campaign › set › creator › step`, and a
cross-stack navigate resolves to nothing at runtime while passing every build check — the
Stage 1 lesson, and the reason Stage 2 put all seven wizard screens in one stack.

---

## 6. Open question for the founder

**One.** The board (FINAL 4, panel ⑦) says the tab-bar badge is *"the only number that spans
both halves"* — Campaigns plus Creators. Today `forBrand` already returns `total` as exactly
that, and the brand app shows **no tab badge at all**.

Turning it on means a number appears on the brand's tab bar for the first time. Against
today's practice data that number is **8** — five inside campaigns, three conversations.

**My recommendation: turn it on.** It is the entry point to everything else in this stage,
and a ladder nobody is told to climb gets climbed by nobody. Flagging it because it is the
one change a brand will notice without opening anything.
