# Stage 2 walkthrough — Batch A

**Nine changes to the campaign wizard. Eight are removals. The ninth stops something blocking.**

Source: the founder walked Stage 2 on a handset on 2026-08-27 and sent six screenshots with a
punch list. This contract covers only what he asked for, plus one thing his screenshots found
that he did not ask about.

---

## 1. What he asked for, verbatim, and what it maps to

| # | His words | File · line | Verdict |
|---|---|---|---|
| 1 | *"no need of 'No end date and no budget Here' info"* | `BrandCampaignCreateScreen.js:92` | **Confirmed.** One `<View style={s.lock}>` block |
| 2 | *"Keep only start date"* | `BrandSetWizardScreen.js:413` | **Confirmed, sales sets only** — see §3 |
| 3 | *"date picker instead of manual entry"* | `BrandSetWizardScreen.js:411, 416` | **Confirmed.** Both are `TextInput placeholder="YYYY-MM-DD"` |
| 4 | *"remove end date field with never"* + *"no end date on a sales set is not necessary"* | `:420, :426` | **Confirmed** |
| 5 | *"from budget field onwards remove till No 'who post?' step"* | `:438` → `:517` | **Confirmed, sales sets only** — see §3 |
| 6 | *"keep only Instagram and youtube… this is only one sustain"* | `CHANNELS` const | **Confirmed.** Channels survives, trimmed to two; min-channels goes |
| 7 | *"a button with 6 hidden — wrong aim needs to remove"* | `:548` | **Confirmed.** Nothing replaces it — see §4 |
| 8 | *"go and ask someone new button not required"* | `:600` | **Confirmed** |
| 9 | *"dont make this [offer] mandatory"* | `:629, :787` | **Confirmed** |
| 10 | *"not required What shoppers pay"* → **withdrawn** same day | `:722` | **Not done.** He reversed it once told it was the only way into the basket preview |

---

## 2. What his screenshots found that he did not ask about

Screenshot 5 and 6 show the campaign detail screen carrying a **six-stage strip** —
`Fund · Roster · Contracts · Production · Review · Payout` — from `utils/campaignStages.js`.

That is the pre-Stage-3 Command Center vocabulary. Stage 3 agreed a **different** six
(`Agree · Sign · Shoot · Shop posts · Go live · Complete`) and **never touched this screen**:
`git log` shows its last three commits are a recolour, a Part-5 date change, and an IG-clean
restyle. None of them is Stage 3.

Two six-step vocabularies, half the words colliding (`Contracts`/`Sign`, `Production`/`Shoot`,
`Review`/`Shop posts`). This is the recurring **two things doing one job** fault.

**Founder's decision, 2026-08-27:** rebuild that screen to match Stage 3, as **its own stage**.
Explicitly **not** in this batch. Recorded here so it is not lost.

---

## 3. The one place his instruction cannot be applied literally

`BrandSetWizardScreen` builds **both** kinds of set, and every block he listed is inside a
`{selling && …}` or `{!buyingContent && …}` branch. His six screenshots are all **sales** sets.

On a **pay-for-content** set:

* `Posting window from → To` is a real window, not a greyed "Never"
* **Budget** is `derivedBudget` — the figure the wallet must cover before the campaign can
  publish. Removing it would stop content campaigns going live.
* **What you are buying** (2 reels, 3 stories…) is the entire point of the set

**Founder's decision, 2026-08-27: sales sets only.** Content sets are untouched.

---

## 4. The chip, and the sentence I proposed instead

The `N hidden — wrong aim` chip is not a button. It explains why a brand who agreed with nine
people sees three: the other six agreed a *different aim*, and a commission set cannot hold a
pay-for-content agreement.

I proposed keeping the fact as a plain sentence, and put that on board ③.

**Founder, 2026-08-27, with the trade-off in front of him: the explanation is not necessary
either.** Both go.

**Consequence, stated once:** the six are still filtered out. The screen no longer says why. A
brand who agreed with nine and sees three will not be told the reason. That is his call, made
knowingly, and it is not re-litigated below.

## 4a. "See what a shopper pays" — asked for, then withdrawn

Founder, 2026-08-27: *"not required What shoppers pay"*. I checked before removing it and found
that button is the **only** route into `BrandBasketPreview` — one `navigate()`, at
`BrandSetWizardScreen.js:311`. Removing it would have left the screen built, registered and
unreachable, and broken two assertions in `stage2CampaignWizard.test.js`.

Told that, **he reversed the same day: keep it.**

**Nothing on step 4 changes except the mandatory gate.** Recorded because the reasoning is worth
keeping: a button that looks like clutter can be the only door to a screen, and the cost of
finding that out afterwards is a dead screen nobody notices for months.

## 5. Why making the offer optional is a correction, not a relaxation

Checked against the live database on 2026-08-27:

* `campaign_sets` — **no offer columns at all**
* `campaign_influencers` — `brand_offer_id`, `offer_type`, `offer_config_json`,
  `offer_expires_at`, `offer_valid_until`, `promoted_brand_offer_ids`; **all nullable**
* rows carrying an offer today: **0**

The data model holds offers **per creator** and has never required one. The wizard asks once at
set level and refuses to save without it. **The screen invented the rule.**

`canFinish` (`:629`) is
`picked.length > 0 && everyoneAllocated && (!selling || !!chosenOffer)`. The third clause goes.

Everything else about the offer — moving it to creator level, and the builder's parity with web
— is **Batch B** and needs its own boards.

---

## 6. Out of scope, stated

* **Batch B** — the offer at creator level, and the phone builder reaching parity with web
  (missing: free-gift type, scope store/category/products, redemption channels, the
  pay-at-store applicability warning). ⚠️ Includes a **live defect**: `buildDiscount` hardcodes
  `scope: 'store'`, so every offer built on a phone silently applies to the whole store.
* **The campaign screen's old six-stage strip** — its own stage, per §2.
* Anything a pay-for-content set needs, per §3.
* Server, database, brand-web. **Batch A is phone-only and touches no data.**
