# The plan — finishing the brand and creator apps

**Written 2026-08-30.** This replaces stages 1–5 of `THE_PLAN.md`. Stages 6–11 are follower work
and are untouched.

Nothing starts until you lock this.

---

## Why five stages became four

Your set-first architecture removes the boundary between agreeing and building. The set **is**
the agreement now. So the old Stage 1 and Stage 2 are one thing.

| Old plan | New plan |
|---|---|
| 1 · Find each other and agree | **1 · Find, agree and build — one flow** |
| 2 · Build a campaign from the phone | *(merged into 1)* |
| 3 · Both sides watch the work happen | **2 · Both sides watch the work happen** |
| 4 · The shoot | **3 · The shoot** |
| 5 · The content goes live | **4 · The content goes live** |

That is not a renumber. It is the largest simplification in the whole programme: one negotiation
instead of two, one message to her instead of two, and one place where terms live.

**When these four are done, the brand app and the creator app are finished.** Everything after is
the follower app.

---

## The shape of a set — the rule everything else follows

> **A set is one aim, one posting date, one shoot mode. Everything else is per creator.**

| Fixed for the whole set | Different for each creator |
|---|---|
| Aim — pay per sale · pay for content · both | Commission %, or money, or both |
| Posting date | Deliverables *(pay-for-content only)* |
| Shoot mode — store visit or remote | What she can sell |
| | Her shopper offer |
| | Her channels |

**If she will not accept the date or the mode, she does not stay in the set.** You are asked
whether her proposal works for you; if it does, she moves to a set that matches what she agreed.
If she will not accept the money, that is settled inside the set — money is what a set lets vary.

**The timing rules**

- A set's posting date must be at least **7 days** ahead
- Invitations and negotiation **close 3 days before** the posting date
- Her shoppable posts must be live on INFLX **1 day before** she posts on social
- A store visit must finish **1 day before** she posts

---

# Stage 1 · Find, agree and build — one flow

**What you'll be able to do:** open the app, name a campaign, create a set — *"sarees, posting
12 September, store visit, pay per sale"* — pick fifteen creators three different ways, and send
each of them her **whole deal in one message**: her commission, what she can sell, her shopper
offer, and what her followers get.

She opens it once and answers once. Today she is asked twice — a handshake, then a brief — and
the only thing the second one adds is the offer.

**When she counters:** if it is the money, you settle it and she stays. If it is the date or the
way she works, you are asked plainly — *"she wants the 19th, remote. That is not this set."* Say
yes and she moves to a set that matches, carrying her commission with her. Say no and she is
declined. **A disagreement stops losing you a creator.**

**Which apps:** brand · creator
**Where the work lands:** App (both) · Backend · Database
**Size:** Large

---

# Stage 2 · Both sides watch the work happen

**What you'll be able to do:** tap a campaign, see its sets; tap a set, see its creators; tap a
creator, see her six steps; tap a step, do the thing. Work owed adds up at every level, and every
badge equals exactly what is underneath it.

She sees the same six steps with the same numbers. When you ring her and say *"we're stuck on
step 3"*, you are both looking at the same thing.

**Mostly built.** The six-step ladder and the counts exist and are live. What changes is that the
steps now start at the set invitation rather than at a separate handshake, so the ladder gets
shorter and truer.

**Which apps:** brand · creator
**Where the work lands:** App (both)
**Size:** Small — most of this shipped in the old Stage 3

---

# Stage 3 · The shoot

**What you'll be able to do:** the shoot opens in the mode the set already fixed. There is no
question to ask and no mode to switch.

**Store visit** — you send the time, the place and who she asks for. She accepts or counters.
When it is done, **you** mark it done, because it happened in front of you.

**Remote** — she sends the address to ship to. You dispatch and add the tracking number. She
confirms what arrived, item by item, and flags anything missing. **A shortfall never becomes her
problem** — she shoots what came, and you decide whether to resend or drop it. When it is done,
**she** marks it done, because you cannot see whether it happened.

**Largely built and currently broken in ways we have been fixing all week.** What remains is
making the mode come from the set, cutting three modes down to two, letting her start the remote
one, and the marking rule above.

**Which apps:** brand · creator
**Where the work lands:** App (both) · Backend · Database
**Size:** Small–Medium

---

# Stage 4 · The content goes live, in the right order

**What you'll be able to do:** know that traffic never lands on an empty shelf.

**Pay for content** — she submits every agreed deliverable to you. You approve. She schedules the
posts, marks them scheduled, and her job is done. Her money arrives in three parts: **25% when
she signs**, **25% when you confirm the posts went live**, and **50% after a delay you set** —
seven, fifteen or thirty days.

**Pay per sale** — she submits her content for your review, schedules it, confirms, and that is
all. There is no fee, so there is nothing to release.

**Both aims** — her **shoppable posts on INFLX go to admin**, not to you, and they must be live
**before** her social post. Admin also sets the minimum number of shoppable posts per
collaboration — say five — so a follower who taps through always finds something to buy.

**Which apps:** creator · brand · **admin**
**Where the work lands:** App (both) · Admin (web) · Backend · Database
**Size:** Large

---

# The fourth surface nobody has counted

Stage 4 needs **admin**, and admin is not a phone app — it is `brand-web`. Three things live
there:

| | |
|---|---|
| Reviewing shoppable posts | the screen exists at `admin/posts` |
| The minimum shoppable posts per collaboration | **new setting** |
| The delay before the final 50% | **new setting** |

Small, but Stage 4 does not work without it.

---

# What we are deliberately not doing

| What | Why |
|---|---|
| Anything in the follower app | Stages 5–11 of the original plan; not this job |
| Redesigning Wallet or Profile in either app | Nothing in this flow touches them. They get a sweep to confirm they still fit, not a rebuild |
| Adding and pricing products on a phone | Bulk work against a catalogue. Stays on the desk |
| Goods travelling creator to creator | Four commercial questions with money attached. Yours to decide, not design |
| Standalone handshakes | **Kept, not deleted.** They stop being a prerequisite for a campaign, but creator pitches and your agency features still run through them |

---

# What happens at every stage, without exception

Unchanged from the plan you already locked:

| | Step |
|---|---|
| 1 | Reality check — what exists, and where I looked |
| 2 | What changes |
| 3 | What we're NOT doing |
| 4 | **Mockups — every screen this stage touches, drawn** |
| 5 | **You lock the mockups. Nothing is built before this** |
| 6 | Build |
| 7 | What it means, with a real example |
| 8 | Your test plan, on real phones |

---

**Nothing is built until you lock this.**
