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

---

# Item 6 — where she works, always negotiable

Founder: *"lets store visit or remote make them negotiable if it is open for negotiation"*,
and later: *"Money, time, style of promotion (store or remote) and finally deliverables —
all these should be negotiable in pay for content. If it is sale then percentage, time,
style of content making — these three are enough."*

## What changed

Working style was **optional**, with a "Not stated" chip and a requirement-or-preference
marker. It is now **asked on every collaboration** and **always negotiable** — it sits
beside money and time.

A term cannot be both negotiable and marked *"cannot be countered"*, so the marker control
is gone from the brand's screen.

## Legacy markers are tolerated, not refused — and that asymmetry is deliberate

Item 4 could **refuse** a leftover marker on deliverables outright, because no live
conversation carried one.

Working style is different. On the day this shipped, **all 14 live requests carried a
marker** — twelve `preference`, two `requirement`. Refusing would have broken every one of
those conversations the moment either side countered.

So the marker is **ignored, not honoured**. The two conversations that said "this cannot be
countered" become counterable, which is precisely the change that was asked for.

## A regression this nearly shipped

Her screen rendered the working style **only when a marker was present**:

```
{t.mode && imp.mode === 'preference' && <WorkingStyleRows … />}
{t.mode && imp.mode === 'requirement' && <WorkingStyleRows … />}
```

New requests carry no marker. Leaving that would have shown her **no working style at
all** — a regression hidden behind a condition that used to be true and quietly stopped
being. It now renders whenever a style is stated, marked negotiable.

## Proved against live data, correctly the second time

A first check reported **2 of 14 requests would break**. That was my harness, not the
platform: it validated a *counter* — a partial change like `{money: 22%}` — as though it
were complete terms. The platform settles the counter onto the original first.

Re-run the way the platform actually does it: **14/14 requests and 8/8 agreements valid**,
including the two mid-negotiation ones.

## Verified

10 assertions: no style refused · all three ways accepted · an invented style refused ·
counterable on both deal types · a style once marked "requirement" is now counterable ·
legacy markers tolerated.

Mobile 188/188. Bundle builds. No migration.

---

# Item 7 — counter where the number is

Founder: *"when influencer is click on counter, then it should be like at that place only
we get counter. means at commission button beside it enter counter percentage, if date is
ok for creator then he click OK then same date will come. instead separate form below
arrange adjacent only."*

## What was there

Tapping Counter revealed a **second copy of the whole offer** further down the page, with
the brand's terms as grey placeholder text. She had to retype anything she wanted to keep.

That is not just extra work — it is how a creator who only wanted more money **moved the
date as well**, by retyping it slightly differently. The history then recorded two moves
where one was meant.

## What it is now

The terms themselves become editable, in place. The heading changes from **MUST BE
AGREED** to **CHANGE WHAT YOU DISAGREE WITH**, and each row shows either:

* **✓ fine** — she has not touched it
* **was 18%** — she has, and here is what it was

Every control opens **pre-filled with the brand's own figure**, so *no change* is the
default. Tapping Remote and then Store visit again counts as **no change at all** — she
ended where she started.

The button counts: **SEND COUNTER · 2 CHANGES**, and is disabled at zero rather than
sending an empty counter.

## The part that decides what travels

Pre-filling every control means the screen now holds a **complete copy of the deal**.
Sending all of it would record four moves where one happened — the same fault in a new
costume.

So the comparison lives in `utils/collabCounter` with **14 tests**, not inside the screen.
It decides what travels and what the button says; a mistake there would show up as a
counter that quietly changed something she never touched, which is precisely what item 7
removes.

Pinned by those tests: an untouched offer sends **nothing**; changing the commission is
**one** change and does not re-send the date; countering a fee **leaves the agreed
deliverables alone**; deliverables never count on a sales deal; and a counter never carries
an importance marker, which the terms model refuses on both negotiable terms.

## Evidence

Mobile **202/202** (188 before; 14 counter-diff checks added). Bundle builds. All 13
`ig.*` tokens in that screen resolve.

---

# Item 8 — naming the exact products

Founder: *"also what they should promote, here you need to add products also, we have now
only entire store, category, apart from this add individual product also as an option."*

## Why this is more than a third chip

**"Their whole store" and "a category" both keep absorbing new arrivals.** A saree added
next month is inside the deal without anybody agreeing to it. **A hand-picked list never
does** — and that difference was invisible while those were the only two options.

## What was already there, and what was not

The terms model **already** accepted `level: 'products'` with `product_ids`, and already
refused an empty list. The creator's screen already rendered a products scope. **Only the
brand had no way to choose them.**

So this is a picker, not a new concept: search your catalogue, tick what she may promote,
done. Kanchi Silks has 11 products to pick from; a brand with none is told to add them on
the web dashboard rather than shown an empty list with no explanation. Products not
currently live in the store are shown and marked, rather than hidden — a brand may well
want a creator promoting something about to launch.

## The names travel with the ids

A picked list used to reach her as **"3 specific products"** — a count she could not act
on. The picker now sends the **names** alongside the ids.

That is deliberate rather than convenient: an agreement is a record of what was offered
**on the day**. If a product is renamed or deleted next month, the agreement should still
say what was on the table. She sees up to three names, then "+2 more" — about as much as a
row carries before it stops being readable.

## Verified

6 assertions: a picked list with names accepted · without names still accepted (anything
sent before this) · an empty list refused · the level with no ids refused · whole store and
category both still working.

Mobile 202/202. Bundle builds. Duplicate-route check clean across all stacks. All palette
tokens resolve. No migration.

---

# Item 9 — a category from the listing tree

Founder: *"if we select category, as a promotion material then, it should appear from our
listing engine tree."*

## A bug underneath, proven live before touching anything

There was already a brand endpoint mapping a brand to its listing vertical. It read:

```
cat.startsWith('fashion') ? 'fashion' : cat
```

**Case-sensitive.** Brands carry both `Fashion` and `fashion` in production, so a
capitalised brand resolved to a vertical named `Fashion` — which matches no node — and its
category list came back **empty**.

Checked against production first: **Kanchi Silks, the practice brand with 11 products,
returned `vertical=Fashion, categories=0`.** This is the same casing split flagged days ago
in the admin brand list, now provably breaking a feature.

One resolver now, case-insensitive, returning **null** for a business with no tree at all
rather than inventing a vertical with no nodes.

## What was already there

The tree is real: **333 nodes**, fashion (234) and furniture (99), with parents, depth and
leaves. The terms model already accepted `scope.category_node_id`. A public
`/listing/tree` endpoint already existed.

**Only the brand app had no way in.** So this is a picker plus one brand-scoped endpoint,
not a new taxonomy.

## Flat with a path, not an expanding tree

`GET /brands/me/listing-tree` returns the brand's own slice, flattened, each node carrying
a readable path — **"Women › Ethnic Wear › Saree"**.

There are **195 leaves** in fashion. Searching a flat list beats opening three levels on a
phone, and the path says where each one sits. Only leaves are offered: *"Women"* is not a
category anyone promotes.

## The id travels with the path

Same decision as item 8. The **id** links the agreement to the tree — which is what makes
the deferred piece possible later, constraining her post to the products inside the agreed
category. The **path** keeps it readable if the tree is reorganised.

A typed category is still accepted, so requests sent before this keep working.

## Verified

4 assertions on the scope shape, 7 on the resolver — including every category string that
exists in production today. The tree query run against production: 234 fashion nodes,
195 leaves, real paths.

Mobile 202/202. Bundle builds. Duplicate-route check clean. No migration.
