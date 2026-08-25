# Stage 3 — expected outputs

What must be true when this stage is done. Each row is checkable, and the check is named.

---

## 1. The numbers (server)

| # | Assertion | How it is checked |
|---|---|---|
| N-1 | A node's total equals its own plus the sum of its children's totals, at **every** level | executing test over `collabCounts` with a stubbed connection, plus a read-only run against production |
| N-2 | The tab total equals the campaigns' totals plus the Creators tab's own | same |
| N-3 | An ended or cancelled campaign contributes **nothing** | existing behaviour (`status NOT IN ('cancelled','completed')`) — pinned so it cannot regress |
| N-4 | **Campaign-level** owed items are counted: wallet short · never published · 30 days of zero sales | executing test per item. Today `camp.own` is hardcoded 0 |
| N-5 | **Set-level** owed items are counted: creator with no allocation *(exists)* · empty set · everything in scope out of stock | executing test per item |
| N-6 | An expiring offer is counted **when a deadline exists**, and honestly zero when none does | executing test both ways. Nothing writes a deadline today — see Stage 2's punch list |
| N-7 | The step and turn for a collaboration come from `collabStep.stepForCollaboration` and nowhere else | grep: exactly one derivation in the repo |
| N-8 | Every owed item can be traced to the level that owns it — nothing is counted twice, nothing is counted nowhere | executing test: sum of every leaf item equals the tab total |

---

## 2. The brand phone

| # | Assertion | How it is checked |
|---|---|---|
| B-1 | The Campaigns tab carries a badge, and it is the server's number, not a local sum | walk W1 + grep: no client-side addition of the tree |
| B-2 | Each campaign row carries its own badge; an ended campaign carries none | W2 |
| B-3 | Campaign-level owed items are listed **above** the sets | W3 |
| B-4 | Each set row shows six mini-bars and its badge | W3 |
| B-5 | Set-level owed items are listed above the roster | W4 |
| B-6 | Each creator row shows the step number **and** whose turn it is | W4 |
| B-7 | The per-creator spine exists, six steps, each badged with its owner | W5 |
| B-8 | A step that is not the brand's carries **no button** and says why | W5 |
| B-9 | Every step either opens something or says plainly which stage brings it | W6 |
| B-10 | Home's needs-you list is the same tree, flattened, each row deep-linking | walk |
| B-11 | `needs_you` is read, not discarded — the grep that returns zero hits today returns hits | grep |

---

## 3. The creator phone

| # | Assertion | How it is checked |
|---|---|---|
| C-1 | Her collaboration shows the **same six steps** as the brand's, with the same current step | W7 — the assertion the stage exists for |
| C-2 | `collabDetailModel.SPINE` and `spineFor` are **deleted**, not repaired | grep: zero references |
| C-3 | The step she sees came from `/influencers/me/needs-you`, not from a local derivation | grep |
| C-4 | Her Collabs **stage** (Stage 1) and her **step** agree — the same fact shown twice | executing test over the mapping |
| C-5 | Her tab badge still works and still equals the server's total | W7 — regression |

---

## 4. Regression and governance

| # | Assertion |
|---|---|
| R-1 | The brand's existing campaign detail, sets list and roster still work |
| R-2 | Stage 2's wizard is untouched |
| R-3 | `pnpm qa` certified **no-regression** against the documented baseline. **Never claimed green** |
| R-4 | Both mobile suites green |
| R-5 | Duplicate-route check clean across every stack in **both** apps |
| R-6 | `06-diff/notes.md` written: promised, built, **diverged**, what to check |
| R-7 | **The founder walks both handsets.** THE_PLAN names this as the stage where the skipped device check stops being skipped |
| R-8 | A Maestro flow covers the brand ladder — the gap Stage 2 left open, and Rule 5's requirement before `released` can be true |

---

## 5. What this stage explicitly does not have to prove

* That the shoot works — Stage 4
* That content goes live in the right order — Stage 5
* That an offer can carry an expiry — Stage 2's punch list
* That brand web shows any of this — phones first
