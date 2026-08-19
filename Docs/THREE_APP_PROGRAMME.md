# The three-app programme — one plan for brand, creator and follower

**Written 2026-08-19, before any building.** Nothing here starts until you approve it.

This replaces two separate plans:
- the collaboration programme (brand + creator), phases 0–8
- the follower programme, slices 0–7

They were written apart, and they overlap in five places. Building them apart would have
built the same things twice and let them disagree.

---

# PART 1 — What I checked, and the four things the old plans got wrong

You asked me not to repeat the Phase 1 mistake. So before writing a word of this plan, I
opened the actual system and checked. Seven checks. Four of them changed the plan.

## The four corrections

### 1 · A place lookup already exists — we were about to build one

The brand plan said: *"There is no list of states, cities or nearby towns anywhere in the
system today"*, and budgeted a new database addition for it.

**Wrong.** A working place lookup is already live and already paid for — it powers the
follower app's location search today. It can find any Indian city, area or landmark.

**What changes:** brand-searches-creators-by-area gets cheaper. We connect what exists
instead of building and maintaining a list of Indian places ourselves.

### 2 · Half the creator's Collabs tab is already built — in the wrong place

The plan treated the creator's pitches-and-invitations screen as a new build.

**It exists.** It is a substantial, finished screen. It is buried three taps deep under
Profile — which *is* the original bug you reported about Sagar Joshi.

**What changes:** that stage becomes largely a **move**, not a build. Cheaper and faster
than planned.

### 3 · There is a half-finished "reels" feature nobody can reach

I found an approved, signed-off contract for shoppable reels from June, with a database
table already created for it — and **no screen and no server code was ever written.** The
table sits empty and unused.

**What changes:** the follower video work must either finish it or formally kill it. Leaving
it is how we end up building video twice. **My recommendation: kill it and absorb the idea
into the post-and-video stage**, because the world moved on since June — posts and videos are
now one thing, not two.

### 4 · The project's own notes about what's finished cannot be trusted

This is the important one, and it explains Phase 1.

Of 439 recorded pieces of work, **231 are marked "not released" despite being live and in
use.** More than half. The field stopped being maintained a long time ago.

So when I read the notes and they said something wasn't done — that told me **nothing**. I
treated it as evidence. It wasn't.

**What changes:** the notes are no longer allowed to answer "does this exist". Only the
running system answers that. See Part 2.

## What I confirmed as correct

| Claim | Verdict |
|---|---|
| Brand can already control who pitches them | ✅ True — do not rebuild |
| Creator groups have a finished server and no screen anywhere | ✅ True — built, unreachable |
| The shoot has no screen of its own on either phone | ✅ True |
| A creator cannot open one of her own posts | ✅ True |
| Brand registration never asks if the shop is physical | ✅ True |
| The follower feed has no ranking — followed first, then newest | ✅ True |
| The post-to-sale link shipped and works | ✅ True |

---

# PART 2 — How we stop this happening again

Four misses in Phase 1, one cause: **I inferred instead of looking, and my inferences went
into a document that then looked authoritative.**

So the fix is not "be more careful". It is a step that cannot be skipped.

## The Reality Check

**Before any stage is planned, every item in it gets four questions answered — with proof.**

**1 · Does this already exist under a different name?**
Search by what the thing *does*, never by what I would have called it. Today this found the
place lookup and the abandoned reels work.

**2 · Did I check both ends?**
The server *and* every app that would show it. Never one and assume the other. Phase 1's
biggest miss was checking the server, finding nothing, and never opening the phone.

**3 · Is my source the running system, or a document?**
Documents — including my own earlier notes — are not evidence. Half of them are out of date.

**4 · Has it actually been run?**
The screen opened. The endpoint called. Not "the code looks like it does this".

## Every item gets one of four verdicts — written down

| Verdict | Meaning |
|---|---|
| **Exists** | Working and reachable. Do not rebuild. |
| **Exists but unreachable** | Built and finished, but no way for a person to get to it. **Connecting it is a fraction of the cost of building it.** |
| **Partly exists** | Some of it is there. The plan says exactly which part. |
| **Doesn't exist** | Checked all four ways. Genuinely new. |

**"Exists but unreachable" is new**, and it is the one that cost us most. Creator groups and
the reels table are both in this state. Neither plan had a word for it, so both were about to
be rebuilt.

**Nothing may be called "missing" unless the Reality Check says so.** If I write "this
doesn't exist" without a verdict behind it, that is a defect in my work, not a detail.

## What you will see from this

Each stage now opens with a short table: every item, its verdict, and where I looked. You can
read it in a minute, and if something looks wrong to you, you will catch it before we build.

---

# PART 3 — The five places the two plans overlap

This is why they had to be merged.

**1 · The numbers are one thing, described twice.**
The brand plan's "analytics cut four ways" and the follower plan's "three dashboards" are the
same computation seen from different sides. Built separately, they will show different totals
for the same sale, and then nobody trusts either. **They become one stage.**

**2 · Channel tracking feeds the brand's analytics.**
"Instagram brought 340 clicks and 12 orders" comes from the follower plan's link system, and
it is what the brand plan promises brands. Links must be built **before** the numbers.

**3 · The post-to-sale link is the spine under all of it.**
Already shipped. It is why the creator can now see which post sold what, and it is what the
brand's per-post numbers and the follower statistics will both read. One good decision already
paid for three times.

**4 · Pay-at-store is a follower feature that needs a brand change.**
The button can only appear for brands with a real shop, and nothing has ever asked them. The
question goes on the brand app; the button appears in the follower app. One stage, two apps.

**5 · The creator who is also a brand touches all three apps.**
He signs up in the creator app, sells his own products in the follower app, and must never be
paid commission on his own sale. That rule lives in the money code the brand side uses.

---

# PART 4 — The plan: nine stages

Each stage is **a complete flow you can test**, not a list of parts. Four are done.

| | Stage | Apps | State |
|---|---|---|---|
| ✅ | Foundations — history, step counting | server only | Done |
| ✅ | What a collaboration paid + products by kind | creator | Done |
| ✅ | Recording what followers do + post-to-sale link | follower | Done |
| ✅ | Follower profile repairs | follower | Done |
| **1** | **A brand asks a creator, and she sees it** | brand + creator | Next |
| **2** | **A follower watches a post and buys** | follower + brand | |
| **3** | **One link per channel, one code per post** | creator + follower | |
| **4** | **A brand runs a campaign from the phone** | brand | |
| **5** | **The shoot, and the content** | brand + creator | |
| **6** | **Talking — comments, hashtags, search** | follower | |
| **7** | **A creator who is also a brand** | creator + follower | |
| **8** | **The numbers, built once** | all three | |
| **9** | **A feed that learns** | follower | |

---

## Stage 1 · A brand asks a creator, and she sees it

**Why first:** it closes the bug you reported. A real request for Sagar Joshi is sitting in
production right now, and he cannot see it. Everything else in the programme assumes two
people can reach each other.

**What you get:** a brand searches for fashion creators near Vijayawada, saves fifteen of them
as a group, asks them all in one move, and sees honestly how many were reached and why the
rest weren't. Each creator sees the request on the **first screen** of her Collabs tab, with a
badge — not three taps deep under Profile.

**Where it lands:** the creator's Collabs tab becomes six stages — Invitations, Pitches, To
sign, Shoot, Content, Done. The brand gets a Creators tab holding everything that happens
before a campaign exists.

**Known before we start:** the creator's pitch screen already exists and moves rather than gets
built. Creator groups are finished on the server with no screen — we connect them. Area search
uses the place lookup that already runs.

**Layers:** mostly both phone apps. A little server. No database change.

## Stage 2 · A follower watches a post and buys

**What you get:** swipe up and the next post plays. Videos open full screen; photos don't
enlarge, exactly like Instagram. The creator's face and name sit on top. "Shop this post" at
the bottom. On a post that features one brand only, a second button — **Pay at store** — for
brands that actually have a shop.

**The brand side of it:** brand registration gains one question — *"Does this store exist
physically?"* Existing brands get asked once. **Until a brand answers, no button appears** — a
Pay-at-store that leads nowhere is worse than none.

**Decision needed from you:** a post can *declare* it features one brand, or it can simply end
up tagging one brand's products. Which one earns the button? *My recommendation: judge by the
products actually tagged, because that is what the follower sees.*

**Also here:** we formally kill the abandoned reels work rather than leave a half-built feature
in the system.

## Stage 3 · One link per channel, one code per post

**What you get:** the creator generates one link per social platform — Instagram, YouTube,
Facebook, WhatsApp, X, LinkedIn — for her store and for each post. A click on the Instagram
link counts as Instagram. Every click is ours and exact, so we never depend on what Instagram
chooses to tell us.

Each post also gets a **short code** like `A7K2F9`. The code *is* the link: `inflx.in/p/A7K2F9`
opens the post from outside, and typing `A7K2F9` in the app search finds it. This exists
because Instagram captions cannot carry a clickable link — the code is a link made of nothing
but text.

**The channel follows the money for 30 days**, matching the commission window. So: *"Instagram:
340 clicks → 12 orders → ₹18,600."*

**Decision needed:** code format. *My recommendation: six characters, letters and digits, with
lookalikes removed (no 0/O, no 1/I) so it survives being read aloud or typed off a screenshot.*

## Stage 4 · A brand runs a campaign from the phone

**What you get:** tap a campaign → see its sets → tap a set → see its creators → tap a creator
→ see the six steps → tap a step → do the thing. Work owed adds up at every level, and every
badge equals what is under it.

Then: building a campaign on the phone. Five steps become four — "who posts?" disappears
because it was settled when they shook hands. Picking creators becomes picking from agreements
you already hold.

**This stage requires a real phone test before it ships.** It adds new screens to the phone's
navigation — the exact class of change that passes every automatic check and then crashes on a
real device. That check has been skipped six times running. It stops here.

## Stage 5 · The shoot, and the content

**What you get:** the shoot gets its own screen on both phones instead of being a section
buried in the contract page. The brand lists what's in the parcel — three sarees — and she
confirms them one at a time and flags anything missing, instead of chasing it on WhatsApp.
**A shortfall never becomes her problem** — she shoots what arrived.

Then content, in the right order: **she cannot publish to Instagram until a shop post is live**,
or the traffic lands on an empty shelf. Rejections become a fixed list of technical faults
instead of a free-text box, so faults become countable.

**Already decided by you:** one live shop post lifts the hold, not all of them. Carried forward.

## Stage 6 · Talking — comments, hashtags, search

**What you get:** comments on posts, hashtags that are tappable, and search that finds a post
by code, by hashtag or by text.

**One deliberate exception:** commenting requires signing in. Browsing stays open to everyone;
talking does not. This is the first time the follower app asks for a login before checkout.

**Decision needed:** can a creator delete comments on her own post? Can a follower report one?
Does admin get a queue? *My recommendation: yes to all three, smallest possible version.*

## Stage 7 · A creator who is also a brand

**What you get:** one question at signup — "Influencer" or "Brand + Influencer". He proves he
owns the brand by **signing in with that brand's own credentials** — no list-picking, no admin
approval, any number of brands, at any time.

His own store's products he can post directly and without limit, no campaign needed. Other
brands' products still need a campaign — no bypass. **He earns no commission on his own sales**,
because it is his own shop — but he still sees exactly what each post sold.

A post can mix his products and a partner brand's. Commission fires per product: the partner's
item pays, his own doesn't.

## Stage 8 · The numbers, built once

**This is the merge.** One computation, three views:

- **The creator** sees everything about her own posts — our numbers exactly, and social
  numbers separately, always stamped with when they were last refreshed.
- **The brand** sees only posts made for it. On a post that mixes two brands, each sees only
  its own products' clicks and orders — and **never** the post's likes and comments, because
  likes cannot be split between brands.
- **Admin** sees everything, plus the ability to spot numbers that were invented.

Plus the brand's cut four ways — overall, by creator, by product, by post — and the channel
split from Stage 3.

**Also here:** something finally computes whether a collaboration is *done*. And a post going
dark later never makes her non-compliant — it counted when it was approved.

## Stage 9 · A feed that learns

**What you get:** the follower's feed stops being "newest first" and starts being "what she'd
want". Four signals — what she does, how recent, how near, how well it performs — each with a
weight **you can change from admin without an app update.**

Rules that aren't weights: never the same creator twice in a row, never repeat what she's
already seen, drop sold-out, and **15% of slots held for brand-new posts** — otherwise a new
post can never earn a score and dies unseen.

**Last, deliberately.** It needs weeks of real behaviour before its dials mean anything. We
build it, then tune it on evidence.

---

# PART 5 — How each stage will run

Seven steps, every stage, no exceptions.

| | Step | What you see |
|---|---|---|
| 1 | **Reality Check** | A table: every item, its verdict, where I looked |
| 2 | **What changes** | Plain language — what a person can do afterwards that they can't now |
| 3 | **What we're NOT doing** | The boundary, written down before it can drift |
| 4 | **Screen re-check** | The agreed screens, restated — only the ones this stage changes |
| 5 | **You lock it** | Nothing is built before this |
| 6 | **Build** | You get one plain-language note when it's done: what changed, and a one-line note of whether it was server, app or database |
| 7 | **Your test plan** | One complete flow, several cases — see below |

## What a test plan will look like

Here is Stage 1's, so you can tell me now if this is the right shape.

**The flow: a brand asks a creator, and she answers.**

*Setup: your brand account on one phone, Sagar Joshi's creator account on another.*

**Case 1 — the normal path**
1. Brand app → Creators tab → search fashion creators near Vijayawada
2. Confirm the count shown matches the list
3. Pick three, save them as a group called "Vijayawada fashion"
4. Ask the whole group in one move
5. **Expect:** a screen telling you how many were reached, and naming anyone who wasn't
6. Creator phone → open the app → **expect a badge on Collabs, visible without tapping anything**
7. Open Collabs → the request is on the first screen under Invitations
8. Accept → **expect** it to move to "To sign" on her side and update on the brand's side

**Case 2 — she negotiates instead**
Same to step 7, then counter with a different rate. **Expect:** the brand is told, sees both
the original and her counter, and can counter back or accept. **Expect:** every offer that was
ever on the table is still visible to both — nothing overwritten.

**Case 3 — she says no**
Decline. **Expect:** the brand is told, and the request leaves her Invitations without
vanishing from history.

**Case 4 — the brand doesn't want pitches**
Turn pitches off in brand settings. **Expect:** that brand stops appearing as pitchable to
creators, and any pitch already in flight is unaffected.

**Case 5 — the awkward one**
Ask a group where one creator has already been asked for the same campaign. **Expect:** she is
named as skipped and told why — not silently dropped, and not asked twice.

**Case 6 — the old bug**
Go to the creator's Profile. **Expect:** the old Brand Proposals row is gone, and nothing is
reachable only from there.

---

# PART 6 — Decisions I need from you

Not now — each one blocks only its own stage.

| Blocks | Question | My recommendation |
|---|---|---|
| Stage 2 | How do existing brands get asked the physical-shop question? | A one-time prompt in the brand app, plus admin able to fill it in |
| Stage 2 | Does Pay-at-store follow the declared brand, or the products actually tagged? | Products actually tagged — that's what the follower sees |
| Stage 2 | Kill the abandoned reels work? | Yes — absorb it into Stage 2 |
| Stage 3 | Post code format | Six characters, no lookalike letters |
| Stage 6 | Comment moderation | Creator can delete on her own post; followers can report; admin gets a queue |
| Order | Should the follower stages come before the brand ones? | Keep Stage 1 first; it fixes a live bug. Then reconsider |

---

# PART 7 — What happens in the next window

1. I open with **Stage 1's Reality Check** — every item, verdict, evidence. You read it and
   tell me if anything looks wrong.
2. Then **the screen re-check** — the agreed screens for Stage 1 only, restated.
3. You lock it.
4. I build, and give you a plain-language note.
5. You get the test plan and run it on two phones.
6. Only then do we move to Stage 2.

**One thing to carry over:** the last three stages that shipped were never checked on a real
phone. Stage 4 forces it. If you would rather force it earlier, say so — it is your call, and
it costs a little time per stage.
