# The creator's detail screen was speaking a dead language

**Founder, 2026-08-28:** *"when i click on it it is opening blank page... check screenshot sent
ravi practice creator."*

---

## 1 · What was actually wrong

`collabDetailModel.heroFor` and `sectionsFor` decided what to show by matching the
collaboration's **stage name**. They matched on:

> `invites` · `applied` · `negotiating` · `active` · `tracking` · `completed` · `archive`

`deriveStage` — the function that produces the stage — returns:

> `invitations` · `pitches` · `to_sign` · `shoot` · `content` · `done`

⚠️ **The two lists overlap in exactly one value: `to_sign`.**

Everything else fell through to the default, which returned:

> **"Closed — This collab is closed."** — with `actions: []`

So a creator holding a live invitation was told her collaboration was finished, and given no
button to accept, counter or pass. That is the blank page.

**And it was wider than reported.** `shoot`, `content` and `done` hit the same default. A
creator with a parcel on the way was told her work was over. `sectionsFor` had the identical
fault, so she could not reach her contract, her deliverables or her earnings either.

## 2 · Confirmed against production, not inferred

Ravi K. (practice), read read-only on 2026-08-28:

| | |
|---|---|
| `ci=e80ecf40` | status **`invited`**, campaign *"New test campaign"*, set *"Saree test set"* |
| `agreement_id` | **set** — terms were agreed first |
| contracts | **0** |

Her row buckets to `invitations`, which had no case. The endpoint behind the screen returns her
campaign perfectly — the failure is entirely in the presentation layer.

⚠️ **One correction to my own diagnosis:** I first reported the endpoint returning no row. That
was **my query, run with the wrong second parameter** — it takes `[ciId, influencerId]` and I
passed the id twice. Re-run correctly it returns the row. Recorded because a wrong diagnosis
stated confidently is worse than none.

## 3 · The part that stings

`collabDetailModel.js` carries a comment explaining that `spineFor` was **deleted** by Stage 3
for this exact fault:

> *"spineFor matched on stage names that Stage 1 renamed, and the two lists overlapped in
> exactly ONE value, so findIndex returned -1 and every node rendered todo."*

**`heroFor` sits directly above that comment with the identical defect.** Its neighbour was
diagnosed, removed and documented, and nobody looked up.

## 4 · And the tests passed the whole time

`collabDetailModel.test.js` covered every branch — by feeding `heroFor` the **old** names.

Its own closing comment says so, about `spineFor`:

> *"These three tests used to pass while the thing they tested was BROKEN IN THE APP... The
> tests passed because they passed it the OLD names. That is the strongest argument in this repo
> for testing what the screen actually does rather than what a helper can do when fed ideal
> input."*

**That paragraph was written about the function two lines below, and was equally true of the one
above it.** The file diagnosed itself and was not read.

## 5 · What changed

* Both functions now switch on the six stages `deriveStage` actually returns
* `shoot` gains a case — Stage 4 built that screen and this had never been told
* `done` distinguishes **finished** (earnings) from **cancelled** (closed)
* ⚠️ The default no longer says "closed". An unknown stage reads as **in progress** — telling a
  creator her live work is over is the failure this whole file exists to record
* A guard compares the two lists directly, so a rename cannot split them again

## 6 · Out of scope

* **Sending a briefed creator straight to signing.** The founder asked for that too, and it is a
  different change: the contract is only created when she *accepts*, so going straight to
  "To sign" means creating it at briefing. Its own piece of work, after the contract wording is
  settled.
* The contract wording — `Docs/CONTRACT_DRAFT.md`
* Anything on the brand side
