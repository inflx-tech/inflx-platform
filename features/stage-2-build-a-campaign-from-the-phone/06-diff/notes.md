# Stage 2 — before and after

**Written 2026-08-25, after implementation, before any deploy.**
What was promised, what was built, **what diverged**, and what to check on the handset.

Board: `04-preview/mockups/stage2-screens.html` — open with
`pnpm preview:open stage-2-build-a-campaign-from-the-phone`.

---

## 1. What shipped, panel by panel

| Board panel | Promised | Built | Diverged? |
|---|---|---|---|
| ② Campaigns landing | list + one **+ New**; the web link gone | `BrandCampaignListScreen` — header **+ New**, `openWebDashboard` removed entirely | no |
| ③ Shell | a name and a start date, nothing else | `BrandCampaignCreateScreen` | no |
| ③ Your sets | add / edit / remove, then review | `BrandCampaignBuilderScreen` | no |
| ④ Step 1 · the aim | three cards, each stating its consequence | `BrandSetWizardScreen` step 1 | no |
| ⑤ Step 2 · basics | three branches; end date and budget **disabled and explained**; channels | step 2 | **yes — see §2.1** |
| ⑥ Step 3 · agreements | aim-filtered pick-list, days-left, red under 14 | step 3 | no |
| ⑥ Agreement detail | re-read the terms, open the diary | `BrandAgreementDetailScreen` | no |
| ⑦ Step 4 ① | read-back, one control per creator | step 4 | no |
| ⑦ What she can sell | three scopes, auto-join stated on each | `BrandAllocationScreen` | **yes — see §2.2** |
| ⑦ Product picker | grouped, images, search, select-all, running total, Other group | `components/brand/ProductPicker` | no |
| ⑧ Step 4 ② the offer | library first, build a new one | step 4 section ② + `OfferBuilderSheet` | **yes — see §2.3** |
| ⑧ Basket preview | every candidate, the winner, what she earns | `BrandBasketPreviewScreen` + `POST /campaigns/preview-basket` | no |
| ⑨ Review + blockers | drift by name, five blockers, publish | `BrandCampaignReviewScreen` + `publishGate` | no |

---

## 2. What diverged, and why

### 2.1 The channel vocabulary is wider than the board draws

The board shows four channels — Instagram, YouTube, WhatsApp, their INFLX shop. The stored
vocabulary accepts **seven**, adding Facebook, X and LinkedIn.

**Why:** Stage 7 of `Docs/THE_PLAN.md` gives every one of those its own tracked link. A set
that could not name a channel the platform is about to count would need a migration the
moment that stage lands. Adding a value to a JSON array costs nothing; adding one to an
enum costs a migration. **The four the board draws are the only four the screen offers** —
the extra three are accepted, not shown.

### 2.2 The category picker is a flat path list, not a tree

The board draws category chips. The screen shows a **flat list with a readable path** —
"Women › Ethnic Wear › Saree".

**Why:** it is the same shape `BrandCategoryPickerScreen` already uses for the request
composer, so a brand recognises it rather than learning a second way to pick a category on
the same phone. A nested tree on a 300px-wide screen is also where the web version's
control got hard to use.

### 2.3 A new offer is created live, with no "save as draft"

The library offers both **Save & activate** and **Save as draft**. Inside the wizard only
the first appears, labelled **Save and use it**, with a line saying it goes live straight
away.

**Why:** a draft offer reaches no shopper. Offering to save one from inside the wizard
would let a brand choose the option that makes their sales set do nothing.

### 2.4 The set budget derivation is narrower than `01-spec.md` §5.2 stated

**This is the one place the implementation is deliberately smaller than what was locked,
and it was found by checking production rather than by design.**

§5.2 said `set_budget` becomes derived from the sum of the agreed fees. As built it is
derived **only when the caller sent none, only on handpick sets, and only while the
campaign is a draft.** Three narrowings, each with a reason:

* **only when none was sent** — brand-web's own validation (`page.js:827`) deliberately
  allows a typed budget to EXCEED the fee sum. That headroom is the brand's, and
  overwriting it would silently shrink a budget they padded on purpose.
* **handpick only** — an open-group paid set has no roster to sum. Its money is a
  projection (`per_influencer_budget × max_cap`). Deriving would write zero, and publish
  would then refuse the campaign for having no budget.
* **draft only** — this is the important one. Production carries a **live** campaign,
  *Festive Season 2026*, whose engagement set has `set_budget` NULL while its two creators
  hold **₹55,000** of agreed fees. Without the draft guard, the next set write would have
  moved an **active** campaign's `total_budget` from NULL to 55000 — a field escrow and the
  wallet gate both read, on a campaign whose fee base was locked at publish. More correct
  is not the same as safe to change underneath a running campaign.

Proven, not assumed: the derivation statement was run against production inside a
transaction that was **rolled back**. It matched **0 rows** on both live campaigns.

### 2.5 The `publish-check` endpoint reports less than the Review screen shows

The Review screen combines two sources: the server's `publish-check`, and its own reading
of the picks it is holding. That is not duplication — the server cannot see picks that have
not been sent yet, and this is exactly the design in §5.1 (nothing is invited until
publish). The **rules** live in one place (`publishGate`); the screen adds only the facts
the server does not yet have.

---

## 3. Two things found by checking production that will affect the walk

Neither is a code fault. Both will make the app look broken if nobody is told.

### 3.1 Every practice product is switched off

```
Kanchi Silks (practice): 11 products · active 0 · pushed_to_store 0 · images 0 · categorised 0
Label Fern   (practice):  4 products · active 0 · pushed_to_store 0 · images 0 · categorised 0
Nova Fit     (practice):  3 products · active 0 · pushed_to_store 0 · images 0 · categorised 0
```

Consequences on the handset, all of them **correct behaviour against this data**:

| Screen | What will happen |
|---|---|
| Product picker (allocation) | shows all 18, each marked **not live**, all under **Other · uncategorised**, no images |
| Basket preview | says **"Nothing is live in your store yet"** — an offer cannot apply to a product a shopper cannot buy |
| Publish | an offer scoped to any of these is refused by the *offer on an unlisted product* blocker |

**To make the walk meaningful, 18 practice products need `is_active = true` and ideally a
category and an image.** That is a production data change and has not been made — it needs
its own go.

### 3.2 `'cancelled'` is not a valid `campaign_influencer_status`

Checked against the live enum:
`invited, accepted, negotiating, contracted, active, completed, declined, expired, applied,
rejected_by_brand, slots_filled`.

`campaign.controller.cancelInfluencer` writes `SET status = 'cancelled'`, which Postgres
would reject. **Cancelling an individual creator from a campaign is broken, and has been
since before this stage.** Found while deciding which statuses a derived budget should
exclude — so the exclusion list here deliberately does **not** contain `'cancelled'`, since
including it would have made the derivation statement throw.

Not fixed here: it is out of Stage 2's scope and deserves its own contract. **Filed for the
founder to schedule.**

---

## 4. Merges, not additions

Three duplications were closed rather than widened. This is the fault the Stage 1 handover
names as recurring — four of its twenty-one bugs were two things doing one job.

| Was | Now |
|---|---|
| `BrandProductPickerScreen` (screen) **and** `ProductPickerSheet` (modal) | one `components/brand/ProductPicker`, with a modal wrapper. Both callers keep their original contract — the screen still hands back `(ids, names)`, the offer builder still hands back `[{id, name}]` |
| the offer builder living inside `BrandOffersLibraryScreen` | `components/brand/OfferBuilderSheet`, used by the library **and** the wizard |
| `termsLine` / `settledLine` inside `BrandCreatorsScreen` | `utils/agreementSummary`, used by the Creators tab and three wizard screens |

A test pins the first one: `there is exactly ONE product picker implementation left`.

---

## 5. Evidence

| Check | Result |
|---|---|
| `qa/unit` lane | **338 passed, 15 failed** |
| Same lane at HEAD, in a clean worktree | **293 passed, 16 failed** |
| **New failures caused by Stage 2** | **zero** — every remaining failure is in the baseline set |
| New executing checks added | **34** (`stage2-publish-gate.spec.ts` 18, `stage2-set-budget-and-channels.spec.ts` 16) |
| Mobile suite | **34 suites, 256 tests, all green** (was 205 — +51 from `stage2CampaignWizard.test.js`) |
| Duplicate-route check | clean across **18 navigators** in both apps |
| Android JS bundle | builds; every new screen's copy verified present in the output |
| Backend suite (`backend/tests`) | **NOT RUN** — see below |

**The backend suite could not run.** `TEST_DATABASE_URL` (`localhost:5544`) refuses
connections with `ECONNRESET`; the container reports *Up* but `docker logs` hangs. This is
the same failure the Stage 1 handover recorded on 22 August. So the backend half of Stage 2
is verified by:

* the 34 executing checks in `qa/unit`, which run the real `publishGate`, `campaignRollup`
  and `campaignChannels` functions against stubbed connections
* **read-only queries against production** for every changed statement — the new
  `listProducts` join, the derivation UPDATE (inside a rolled-back transaction), the
  `campaign_influencer_status` enum, and the preview's product query

That is stronger for those specific statements and **weaker** than the broad
did-anything-unrelated-break sweep. It is not claimed as one.

**Not claimed green.** The repo carries a documented pre-existing failure baseline
(`project_test_suite_debt`). Stage 2 is certified **no-regression against that baseline**.

---

## 6. Two mistakes made while building this, recorded

1. **`collectProductIds` takes two arguments, not one.** I called it with one in
   `publishGate`, which made the *offer on an unlisted product* blocker collect nothing and
   silently never fire. Caught by an executing test, not by reading — which is the argument
   for executing tests over source assertions in one line.
2. **Four backend files were flipped from CRLF to LF** by my own editing, which broke a
   source-assertion test that slices on `\r\n`. Restored. Git's autocrlf would have
   normalised it on commit, but the working tree is shared with another window and a
   whole-file line-ending flip makes a diff unreadable.

Two existing assertions were also updated rather than worked around:

* `agreement-briefing.spec.ts` pinned the entire `success()` call as one literal string; it
  broke when a field arrived **alongside** the warnings, not instead of them. It now
  asserts that the warnings reach the 201, which is the actual promise.
* `campaign-end-and-open-ended.spec.ts` asserted a bare **count of three**
  `campaignRollup.recompute` occurrences. Stage 2 added two more legitimate write paths, so
  the count failed because the rule became **more** true. It now names the five handlers.

---

## 7. What to check on the handset

Walk `02-workflow.md` W1–W8. The things most likely to be wrong:

1. **Step 4 on a set with three creators** — the board fits section ① into one screen. On a
   small handset it may scroll further than it reads well. If so the fix is a per-creator
   drill-down, not a fifth step.
2. **The wrong-aim chip at step 3** — if it reads as an error rather than an explanation,
   the wording changes, not the rule.
3. **The basket preview** — it sits behind a button. If it is never opened, the highest
   value screen in the stage is doing nothing, and it may have to be shown inline.
4. **W7, the abandon case** — start a campaign, tick two agreements, kill the app. Both must
   still be in Ready to brief. If they are not, §5.1 was implemented wrongly.
5. **Anything at all involving products**, given §3.1.
