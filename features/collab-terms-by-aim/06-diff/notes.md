# Before / after

# Item 1 — the ₹0

## What was wrong

Every money line on the creator's campaign screen read:

```
agreed_fee || influencer_budget || 0
```

A sales collaboration has no fee — she earns a percentage of what she sells. So all four
places rendered **₹0** and told her the work was unpaid.

**The commission was in the payload the whole time.** `cs.goal` and `ci.commission_pct`
are both selected by the endpoint. The screen never asked for them.

Confirmed in production before touching anything:

| Campaign goal | Rows | With a commission | With a fee |
|---|---|---|---|
| conversion | 4 | **4** | 0 |
| engagement | 2 | 0 | 2 |

**Four live campaigns** — 18%, 15%, 20%, 22% — every one showing ₹0 to the creator.

## What changed

All four sites now read one description of the deal: the headline, the terms row, the
accept prompt, and the decline wording.

* **18%**, with **"of everything you sell"** beneath it. The note is not decoration — a
  bare percentage does not say *of what*.
* Labelled **Commission**, not Fee.
* Passing offers **"Commission too low"**. The *stored* reason stays `fee_too_low`, because
  every report and brand-side screen already reads that value; only her words change.
* Nothing agreed yet reads **"Not set yet"**, never ₹0.

## Extracted rather than left in the screen

The logic lives in `utils/collabPay`, with **14 tests**. It is money: a figure that decides
whether someone accepts work should be checkable without a handset, and the whole fault was
that nobody could see what the screen would render until it rendered.

## One judgement worth recording

**The money present decides; the campaign goal only breaks the tie.** A row can disagree
with its set's stated aim — a conversion set carrying a real fee, or an older row with no
goal at all. Reading `goal` alone would reproduce the same ₹0 in a different costume, so
the shape of the money is authoritative. Two tests pin exactly that.

## Evidence

Mobile suite **173/173** (was 159 — the 14 new money checks). Android bundle builds.
No backend change, no migration.

---

## Item 1, second pass — I fixed the wrong screen

The founder, with a screenshot of the **Collabs list** still reading **FEE ₹0**:
*"i did nt understood what you did on first fix, still have same zero."*

He was right. The first pass changed `CollabDetailScreen` — the page you reach by tapping a
row. The **list you look at first** is a different file with its own row component and its
own normalisers, and it was never touched. Reporting item 1 as done after fixing one of
them was wrong.

## Where the ₹0 actually lived

Four separate places, not one:

| Place | Fault |
|---|---|
| `CollabDetailScreen` | fixed in the first pass |
| `CollabRow` | hard-coded label **"Fee"**, value `fmtRupees(collab.fee)` |
| `normalizeRequest` | `fee: settled?.money?.fee \|\| 0` — a sales request carries a percentage and **no fee** |
| `normalizeProposal` | `fee: p.proposed_fee \|\| 0` — same |
| `getMyCampaigns` (backend) | **never sent `commission_pct` at all** — the list had no way to show anything else |

The screenshot's two rows are **collab requests**, not campaigns — Invitations is fed by
`normalizeRequest`. So even a perfect row component would still have rendered ₹0.

## What changed

* Backend: the campaigns list now sends `commission_pct` and `influencer_budget`.
* Both conversation normalisers carry `goal`, `commission_pct` and `agreed_fee`, so a row
  can **describe** the deal instead of assuming a fee.
* `CollabRow` uses the same `describePay` as the detail screen, so **the list and the page
  it opens cannot disagree about what someone earns**.
* A counter supersedes what was first proposed.

## Why this happened, recorded plainly

I searched for the money field in one screen, fixed what I found, and shipped. The lesson
is the one this codebase keeps teaching: **the same fact rendered in more than one place
will be fixed in one of them.** The answer was to give both surfaces a single shared
description — which is now what they use, pinned by tests that construct a list row and
assert what it will show.

## Evidence

Mobile **178/178** (was 173 — five new list-level checks). Bundle builds. The shipped list
query run against production: four sales campaigns now carry 18 / 15 / 20 / 22, two content
campaigns carry ₹30,000 and ₹25,000.

---

## The Collabs row — asked for "some other details", found a regression

Founder: *"in collab tab in creators app it is better to show some other details as well."*

Looking at what to add turned up why the row looked so bare. **Stage 1 renamed the stages**
to `invitations · pitches · to_sign · shoot · content · done`. `CollabRow` was never
updated, so it still switched on `invites`, `negotiating`, `active`, `tracking`,
`completed`. **Every row fell through to the default.**

Four things had been broken since, silently:

| | Was |
|---|---|
| The hint under every row | **"Archived"** — on invitations nobody had answered |
| The badge | the raw status, so "Viewed" instead of "Your turn" |
| The expiry countdown | tested `stage === 'invites'` — **never once shown** |
| The delivered count | tested `'active'`/`'tracking'` — **never once shown** |

### Why no test caught it

`collabsList.smoke.test.js` asserted `badgeFor` against `'invites'`, `'negotiating'`,
`'tracking'`, `'completed'`, `'archive'` — **five stage names the app had stopped
producing.** It stayed green by feeding the component a vocabulary that no longer existed.

The real fix is the guard now at the top of that describe block: the stages used in the
test must equal `COLLAB_STAGES`. Renaming a stage breaks the test on the spot instead of
quietly detaching it from the app.

### What the row says now

* **Whose turn it is** — "Your turn" / "Waiting on them" / "Agreed", and a hint that names
  the next action: *"Tap to accept, counter or pass"*, *"Waiting for the brand to reply"*.
* **Post by** — the deadline she is actually committing to. It was computed by the
  normalisers all along and never rendered, so the one date that binds her only appeared
  after she opened the row.
* **Expires** and **Delivered** work again.

## Evidence

Mobile **183/183** (178 before this pass; 5 replaced the ones asserting dead stage names,
plus the guard). Bundle builds.

---

# Item 2 — dates are chosen, not typed

Founder: *"while creating invitation, start date entry is better if we keep date picker
instead typing."*

## All five, not one

Every date in the collaboration flow was a text box with a placeholder reading
`2026-09-15`:

| Screen | Field |
|---|---|
| Brand — ask one creator | Post by · Window start · Window end |
| Brand — ask several at once | Post by |
| Brand — invite from a profile | Posting date |
| Creator — counter an offer | Post by / Window end |
| Creator — pitch a brand | Window from · Window to |

On a phone that is four ways to fail: the wrong format, the wrong month, a date already
gone, or a typo nobody notices until a deadline is missed.

## Written in JavaScript on purpose

`@react-native-community/datetimepicker` is in `package.json` — but **nothing in the app
imports it**, so there is no evidence it is compiled into the installed APK. Mobile changes
ship over the air, and **an over-the-air bundle cannot add a native module**: it would
crash on launch, uncatchably, on the founder's handset.

A pure-JavaScript calendar is slightly more code and carries none of that risk. It goes out
in the next OTA like everything else.

## Two rules the picker enforces that a text box could not

* **The past is not offered.** A posting deadline already gone is never a real answer.
* **A window cannot end before it starts.** The "to" picker will not show days before the
  "from" date, so a backwards window can no longer be saved.

## The timezone trap, pinned

`new Date('2026-09-15')` parses as **UTC midnight**, so anywhere behind UTC it renders as
the 14th. India is ahead of UTC, but the app should not depend on where it runs, so the
picker reads the year, month and day by hand. A test asserts the day survives, including
for rows that carry a full timestamp rather than a plain date.

The value in and out is still `YYYY-MM-DD` — **the exact string the text boxes produced, so
nothing behind these screens changed.**

## Evidence

Mobile **188/188** (183 before; 5 date checks added). Bundle builds. No typed date field
remains anywhere in the app.

---

# Item 3 — one date, and it is a deadline

Founder, asked what a single date would mean: *"not post any time from this date — by that
time they should post and campaign should start."*

## What changed

A paid collaboration demanded a posting **window** — a start and an end. A sales
collaboration already had a single **post-by** date. Two shapes for one idea, so the two
halves of the app phrased the same commitment differently and could not be compared.

Now **every aim carries one date**, meaning the same thing in both: she must have posted
by then, and the campaign starts then.

## A window is refused, not ignored

The rule rejects terms that still carry one. Silently dropping a date somebody
deliberately set is how a creator ends up held to a deadline she never agreed to — so the
brand is told instead.

## The break this nearly shipped

`handshake.termsFromProposal` turns a creator's pitch into terms. For a paid collaboration
it emitted `{ window_start, window_end }` — which the new rule refuses. **Accepting a
pay-for-content pitch would have failed validation**, with nothing on screen to explain
why.

It now emits `post_by` from the window's end for every aim. The end was always the date she
actually committed to; the start was never a commitment, only a hint about when she might
begin. The same correction was needed in the history page.

## Her pitch matches too

`SendProposalScreen` offered a from/to window while a brand now offers one date — the exact
drift this batch exists to remove. It asks for one date, stored in the existing
`proposed_posting_window_end` column: that column *is* the end of the window, so no
migration was needed. **Zero pitches exist in production**, so nothing was disturbed.

## Verified

| | |
|---|---|
| All three aims accept a post-by date | pass |
| All three refuse terms with no date | pass |
| A window is refused on paid **and** sales | pass |
| A pitch converts to valid terms, all three aims | pass |
| An older pitch carrying only a start still converts | pass |

**12 assertions, run directly against the module** — jest's globalSetup connects to the
test database before any suite starts, so while that database is down no suite can execute,
including one that touches no database of its own. The suite is written and waiting.

Mobile 188/188. Bundle builds. **No migration** — all 14 live requests and 8 agreements
already carry `post_by`, and none carries a window.

---

# Item 4 — what the fee buys

Founder: *"if pay per content as an option chosen one more important thing is what
deliverables he can expecting for mentioned amount ....this is important for pay for
content.....this is not required for commission based on sale."*

## The rule

**A fee buys specific work, so both sides must know what it buys.** A commission buys
nothing in advance — she earns only if she sells, so counting her posts measures the wrong
thing.

| | Deliverables |
|---|---|
| Pay for content | **required**, and negotiable |
| Fee + commission | **required**, and negotiable |
| Pay per sale | not asked — but a brand wanting a minimum commitment is not prevented |

"Not required" is not the same as forbidden. A sales brand that still wants one reel can
say so; it is simply never demanded.

## Deliverables stopped being an "optional extra"

They used to sit beside scope and working style as an optional term needing a
requirement-or-preference marker. On a paid collaboration that is wrong twice over: they
are **part of the deal**, and the founder listed them among the things a creator may push
back on. So they left `OPTIONAL_TERMS`, take **no marker at all**, and appear in the
counterable set for paid deals only.

A leftover marker is **refused** rather than ignored — it contradicts itself, and silently
dropping it would lose whatever the sender meant.

## Reused vocabulary, and two rules a text box could not enforce

`reel · post · story · youtube_video · youtube_short` — the same five words a campaign
brief and a contract already use. Anything else is refused, so a typo cannot create a
deliverable type nothing downstream understands.

* **The same format twice is refused.** "2 reels" plus "3 reels" is not a richer deal, it
  is an unanswerable one — does it mean two, three, or five?
* **A count of zero is refused.** That is not a deliverable.

## On the brand's screen

A stepper per format, headed **"WHAT ₹25,000 BUYS · NEGOTIABLE"** — the heading names the
actual fee as it is typed. Shown only when there is a fee. On a sales collaboration the
section is absent and a line says why.

## Verified

11 assertions, run directly against the model: required for both paid aims, optional for
sales, allowed for sales, vocabulary enforced, duplicates refused, zero refused, leftover
marker refused, negotiable on paid and not on sales.

Mobile 188/188. Bundle builds. All seven palette tokens the new screen block uses exist.
No migration — terms are stored as one flexible record.

---

# Item 5 — stop asking her the wrong question

Founder: *"when creator counter it is asking what you deliver, this is not required for
sale as an option. this is required for pay for content only."*

## What changed

Her counter form asked **"What you'll deliver — Reels, Stories"** on every request,
including a commission-only one. On a sales deal she earns by selling; being asked to
promise posts was asking the wrong question entirely.

It now appears **only on a paid collaboration**, uses the platform's five formats rather
than two, and is **pre-filled with what the brand asked for** — so a counter about money
does not silently wipe deliverables she was already happy with.

She can also now **see what the fee buys** when reading the request, listed and marked
negotiable. Previously the brand's deliverables were not shown to her at all.

## The break this repairs

Her counter attached `importance: { deliverables: 'preference' }`.

Item 4 made deliverables always negotiable on a paid deal and **refuses a marker**. So that
payload would have failed validation on **every counter that touched deliverables** — a
break introduced by item 4 that only surfaced when building item 5.

The marker is gone, and a test pins the old payload as refused so it cannot return.

## Verified against the live model

| | |
|---|---|
| Sales counter on money alone | accepted |
| **The old payload with the marker** | **refused — the break, pinned** |
| Paid counter moving money and deliverables | accepted |
| Paid counter on money alone keeps agreed deliverables | accepted |
| An invented format in a counter | refused |

Mobile 188/188. Bundle builds. All 11 `ig.*` tokens in that screen resolve.
