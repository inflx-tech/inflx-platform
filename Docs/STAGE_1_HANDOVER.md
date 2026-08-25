# Stage 1 — handover

**Written 2026-08-25, closing the window that ran 22–25 August.**
Read this first if you are picking Stage 1 up in a new window.

Live right now: **brand app v183 · creator app v181.** 32 pushes over four days.

---

## 1. What Stage 1 was meant to deliver

*A brand and a creator find each other and agree* — everything that happens **before** a
campaign exists.

From `Docs/THE_PLAN.md`: search creators by place, size and niche; save a set as a group;
ask them all in one move and get an honest answer about who was reached; the creator sees
the request on the first screen of her Collabs with a badge; both sides counter; every
offer that was ever on the table stays visible to both.

---

## 2. What actually shipped

### The spine (22 August)

* **Brand app gained a Creators tab** — Talking · Agreed · Find · Groups. Everything before
  a campaign now lives in one place. It replaced Alerts.
* **Creator's Collabs tab became six stages** — Invitations · Pitches · To sign · Shoot ·
  Content · Done, all always visible, with a badge when something waits on her.
* **Search rebuilt** to three filters — Where · Works in · Size — each a picker, with live
  counts per city.
* **Groups**, and **asking a whole group or a filtered set** in one move.
* **A shared history page** — "What happened here" — showing every offer ever made,
  identical on both sides.
* **27 brands opened to creator pitches** (3 on the day, after the data wipe).

### Terms, rebuilt around one rule (24 August)

**What can be negotiated depends on how she is paid.**

| Term | Pay for content | Pay per sale |
|---|---|---|
| Money | fee | commission % |
| Time | post by | post by |
| Where she works | negotiable | negotiable |
| Deliverables | **required** | **not asked** |
| What she promotes | optional | optional |

Eleven changes delivered against that rule — see `features/collab-terms-by-aim/`.

### Admin (24 August)

Account review rebuilt: the facts grouped by the question they answer, **Approve and Reject
on the same page**, fee controls hidden until a brand is approved, a creator list that never
existed, and an address-versus-map-pin check.

---

## 3. Every bug found and fixed

Twenty-one. Grouped by how they were found, because that matters more than the count.

### Found by the founder using the apps

| # | What was wrong |
|---|---|
| 1 | **Sales collaborations showed "FEE ₹0"** to the creator. The commission was always sent; four separate screens only knew how to read a fee. |
| 2 | **"Add creators" to a group opened the wrong screen** — the old search, which had never heard of groups, so tapping a creator offered "add to campaign" instead. |
| 3 | **Admin account pages printed dashes** over data already held — four field-name mismatches, and the address never displayed at all. |
| 4 | **The admin had no creator list.** 22 creators unreachable; the page was a CSV upload box. |
| 5 | **Asking a group or a filtered set could not send at all** — two of the three ways to ask a creator were dead. |
| 6 | **The practice brand and creator sat on the founder's own number**, so opening the brand app signed him into a practice shop. |
| 7 | **A real person signed up** — inflx.in is publicly live, and anyone can register and trigger a real SMS. |

### Found while building something else

| # | What was wrong |
|---|---|
| 8 | **"Find brands to pitch" had never worked for anyone.** The query passed a value it never used, so it failed in its default state. The creator's entire outbound route was dead. |
| 9 | **Every Collabs row read "Archived"**, including unanswered invitations — the stage names were renamed in Stage 1 and the row was never updated. The expiry countdown and delivered count had **never once appeared**. |
| 10 | **A creator's pending balance showed one-hundredth of the truth.** ₹4,000 read as ₹40. |
| 11 | **The picture rule shipped without the upload it depends on** — every creator was permanently initials with no path out. |
| 12 | **A duplicate avatar column** created the previous day, beside one that already existed for the same purpose. |
| 13 | **The brand-to-category-tree resolver was case-sensitive**, and existed in two copies. Any brand carrying "Fashion" rather than "fashion" got an empty tree. |
| 14 | **Scraped creators' phone numbers could never be seen** — that branch had no admin handling at all. |
| 15 | **Accepting a pay-for-content pitch would have failed validation** — the pitch-to-terms step still built a posting window after windows were retired. |
| 16 | **Her counter attached a marker the rules now refuse**, so every counter touching deliverables would have failed. |
| 17 | **A test was pinning stage names the app had stopped producing** — it stayed green through a live regression. |
| 18 | **Her working style only rendered when a marker was present**; new requests carry none, so she would have seen nothing. |
| 19 | **Two creator search screens** existed; the newer one's route was never used by anything. |
| 20 | **I built a duplicate listing-tree endpoint** and found on the live check that a better one already existed. Deleted. |
| 21 | **The admin door asked "which of your accounts?"** — fixed by deriving the role from the address. |

### The pattern worth carrying forward

**Three of these — 2, 5, 19, 20 — are the same shape: two things doing one job, and only
one of them getting the change.** Two creator searches, two listing-tree endpoints, two ask
composers. Each was found late, twice by the founder.

The API layer had even written the intent down months earlier — *"the same composer, three
ways in"* — and two screens were built anyway.

**Before adding a screen or an endpoint, search for one that already does the job.**

---

## 4. What is NOT done

### Blocking a Stage 1 sign-off

1. **The founder has never walked Stage 1 on a handset.** Not one screen in this stage has
   been used by a thumb. This is the last real gate, and everything below is secondary.
2. **The full backend test suite has not run since 22 August.** The local test database
   stopped serving connections and Docker refused to restart it. Work since then was
   verified **against production directly** — every changed query run against the real
   database, and endpoints exercised with real accounts — which is stronger for those
   specific changes but is **not** the broad "did anything unrelated break" sweep.
3. **Both Stage 0 and Stage 1 contracts read `released: false`.** Deliberate, not an
   oversight — the suite has never been green.

### Known gaps, not blocking

4. **No practice admin account.** The only admin is the founder's number, which takes a real
   SMS, so no admin flow can ever be tested automatically. This blocked diagnosis three
   times. A fixed-code superadmin would be a security hole, so it needs a deliberate answer.
5. **The public sign-up door is open.** inflx.in serves a working registration page and
   sends real SMS to anyone. Two unknown numbers got in. **Awaiting a decision.**
6. **Preeti Chouhan has been waiting for approval since 23 August.** A real business.
7. **Practice products carry no category link** — all 18 of them — so the new category
   picker shows "none yet" against every category. Correct, but it will look broken.
8. **Brand web still has the old three-way working-style picker** and the old creator
   search. Out of scope by the founder's own instruction that phones come first.
9. **93 pre-existing test failures** predate all of this work. Certify no-regression against
   that baseline; never claim green.
10. **YouTube subscriber counts do not exist anywhere.** Creator profiles say "not
    connected" rather than showing a fabricated zero. Its own piece of work.

### Deferred, now unblocked

**Constraining her post to the agreed category.** Not a collaboration-screen change — it is
a posting rule touching the post composer, the product picker and the scope check. It was
blocked because agreements had no real category; **as of item 9 they carry a real category
node**, so it can now be built.

---

## 5. Where the record lives

| | |
|---|---|
| `features/stage-1-find-each-other-and-agree/` | The stage contract, its two post-release defects, and the handset walk |
| `features/collab-terms-by-aim/` | The eleven terms changes, with before/after for each |
| `features/admin-account-review/` | The four admin items |
| `features/creator-photo-and-reach/` | Photos and the three-way follower split |
| `features/collab-working-style-two-questions/` | Store visit vs remote |
| `Docs/THE_PLAN.md` | All twelve stages |
| `Docs/TEST_ACCOUNTS.md` | Every practice number and its fixed code |

Each contract's `06-diff/notes.md` says what was promised, what was built, **what diverged**
and what to check. They are written to be read cold.

---

## 6. Starting the next window

Say something close to:

> Continuing Stage 1. Read `Docs/STAGE_1_HANDOVER.md` first, then
> `features/stage-1-find-each-other-and-agree/06-diff/notes.md`. Do not build anything
> until I say so.

Then give it **one** of these as the first job:

* **"I walked it, here is what broke"** — the most valuable thing, and the actual gate.
* **"Fix the test database first"** — clears the owed sweep and unblocks everything.
* **"Close the public sign-up door"** — the only outward-facing risk still open.
* **"Build the post-scope rule"** — the deferred piece, now unblocked.

**What the new window must be told, because it cannot infer it:**

* Production is the only environment. Dev, staging and live are the same thing.
* Nothing deploys without an explicit go.
* Screens get drawn and locked before any app code.
* The test suite has never been green; certify no-regression, never green.
