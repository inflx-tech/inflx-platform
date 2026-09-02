# THE CUT — what INFLX is, and what it is not

**Founder decisions, 2026-09-02.** This is Phase 2 of `Docs/THE_FINISH_LINE.md`.

**This document is now the answer to "is X part of the product?"** If something is not on
the KEEP list below, it is not part of INFLX. Nothing on the REMOVE list gets repaired,
discussed or re-litigated — it gets deleted.

Two items are explicitly **DEFERRED** and marked as such. Those are the only open questions.

---

## THE ONE-LINE ANSWER

**INFLX is a fashion platform.** Brands sell clothing and accessories, online and in their
own physical stores. Creators are reached through a campaign, negotiate, sign, post, and
earn commission. Shoppers buy, return, save and review.

Nothing else.

---

## KEEP

### The business
- **Fashion only** — clothing and accessories.
- **Physical fashion stores are in scope.** A shopper can pay a bill standing in the shop.
  Whether a brand has a physical store is asked **at registration**.

### How brands and creators meet — two doors, no more
- **Campaign → set → invite**, by the three agreed routes: an individual, a saved group,
  or a filtered search result.
- **A creator pitches a brand directly.**
- **Brands only ever see creators who have an account and are verified.**

### Money
- Wallet, held money, and the three-part release (25% at signing / 25% when the post is
  confirmed live / 50% thirty days later).
- Subscription plans — four tiers.
- Campaign fee — 3% / 2% / 1% by budget size. **Fix the band-gap bug** (a budget landing
  between two bands currently makes the fee zero for that campaign's whole life).
- Sales commission — 4% to 10% by category.

### What shoppers can do
- Buy for delivery.
- Pay a bill in a physical shop.
- Returns.
- Wishlist and saved boards — **fix the bug** where a signed-out shopper's list is lost.
- Reviews and ratings — **add a nickname layer** so a reviewer's full real name is not
  published.

### Campaign creation
- **Mobile only, for now.** Build the brand and creator phone apps first. Once campaign
  creation is fully developed on the phone, mirror it back into the website.
- The website's campaign builder is retired **for now**, not deleted from the roadmap.

---

## REMOVE

### Whole business lines
- **Restaurants and food** — entirely. Including the dish dictionary, discovery tiles,
  add-ons, restaurant reviews, the nine-part planned-meal marketplace, and ordering food
  by describing it in words.
- **Car and bike rental** — entirely, including the vehicle catalogue.
- **Salons** — entirely, including services and stylists.
- **Furniture.**
- **The other thirty business types on the signup form** — bakery, grocery, hotel, gym,
  clinic, coaching, laundry, pest control and the rest.

### Ways of meeting
- **Agree terms before any campaign exists** — removed **completely**, not kept as
  read-only history. Founder: *"Remove this completely."*
- **Open call / broadcast to everyone matching a filter.** Founder: *"broadcast to large
  number of people not allowed. we already build three things — directly we ask, all
  people in a group, and through matched filter."* The three agreed routes are the whole
  mechanism.
- **Inviting someone who is not on INFLX yet.** Brands see registered, verified creators
  only.

### Money features
- **The referral programme** — entirely.
- **Agency accounts — entirely, including the separate agency app.**
- **The shopper reward wallet (3% back).**

### Shopper features
- **Bookings** — tables, appointments, vehicles. Entirely.
- **Enquiries** — entirely. (Also settles the duplicate-pages question: all three copies go.)

### Never connected to anything
- **The visual design system** — 85 records seeded 10–13 July (moods, palettes, type
  styles, layouts, 24 shop themes). Confirmed: no code in any app or website has ever
  read any of it. Founder: remove it.

### Duplicates
- **Orders** — keep the reachable page, delete the unreachable one.

---

## DEFERRED — the only two open questions

1. **Arranging a shoot** — two screens in each app, only one of each pair kept up to date.
2. **Admin tools** — possibly two entire systems running against live data.

Founder: *"these two we decide later, i will take some time to answer on these two by the
time we concentrate on other."*

Until answered, **both stay exactly as they are.** Neither is touched.

---

## What this cut is expected to remove

| | Before | Expected after |
|---|---|---|
| Businesses supported | 35 | **1** |
| Ways a brand reaches a creator | 5 | **2** |
| Audit findings outstanding | 142 | **roughly 60** |
| Things remembered that are dead | 85 of 140 | — |
| Mobile apps | 4 | **3** (agency app goes) |

Roughly **80 of the 142 audit findings are expected to disappear by deletion rather than
repair** — most of the follower app's problems were food, car-rental and booking screens;
most of the brand app's were the pre-agreement pathway.

---

---

# HOW WE CLEAN

## The one idea that makes this safe

There are three different things people call "removing", and they carry completely
different risk:

| | What it means | Risk | Reversible? |
|---|---|---|---|
| **Hide** | Stop showing it. The code still exists and still works. | **None** | Instantly |
| **Disconnect** | Delete the code. The data stays. | Low | Yes — from history |
| **Erase** | Delete the data. | **Permanent** | **No** |

**We do them in that order, with time in between.** Almost every bad deletion in software
happens because someone did all three in one go.

## The order that cannot be reversed

Remove from the **outside in**: screens first, then the engine, then the memory last.

The reason is simple. If a screen still asks for something you deleted, the screen
crashes. If you delete the screen first, nothing is left asking — so removing the engine
part is safe, and only then is removing the memory safe.

**Doing it the other way round breaks the live app every time.**

## The rule that keeps it traceable

**One cut per commit.** Never "remove food and cars and salons" in one go. If something
breaks, we need to know which single decision caused it — and with one cut per commit,
undoing it is one command.

---

## The six passes

### Pass 0 — Close the front door *(do first; tiny; largest effect per minute)*
Change the signup form from 35 business types to fashion only.

Nothing is deleted. But from that moment **no new wrong data can enter the system** — no
new restaurant can sign up and start listing dishes into a void. Every later pass gets
easier because the thing being cleaned stops growing.

### Pass 1 — Hide everything on the REMOVE list
Take away the screens, pages, tabs and buttons. The engine still answers; nothing breaks.

After this pass **the apps already look correct to a real user**, before a single risky
deletion has happened. In order, cleanest first:

1. The agency app — a whole app, the cleanest possible cut
2. Bookings · Enquiries · The reward wallet · Referrals
3. Food, restaurant, car-rental and salon screens across all apps and the website
4. The pre-agreement pathway — the remaining screens and stored agreements
5. Open call, and inviting people who aren't on INFLX
6. The website's campaign builder
7. Furniture

### Pass 2 — Untangle the bleed *(the careful one)*
**This is the pass that can break fashion, so it is done slowly and on its own.**

Food did not stay in its own corner. It is threaded through everything:
- Every product card, in every business, quietly looks up restaurant reviews
- Vegetarian flags and cost-for-two sit on clothing pages
- Every booking time in the system is one of six fixed restaurant service slots
- Products still carry a link to the master dish dictionary

Each of these is surgery on code that fashion depends on. One at a time, each with a
screenshot before and after.

### Pass 3 — Disconnect the engine
Now that nothing asks for them, remove the server abilities. Roughly 21 genuinely dead
ones, plus everything orphaned by Passes 1 and 2. Each verified by checking the app still
works afterwards.

### Pass 4 — Retire the memory *(last, and on its own)*
Only after everything above has been live and stable.

- **72 things have never held a single record** — dropping these is safe.
- **13 hold stale data** (360 dishes, 44 cars, 37 salon services, the 85 design records).
  **Export each to a file first**, then drop. If a decision is ever reversed, the data is
  recoverable from that file even though the code is gone.
- The pre-agreement records (41 requests, 22 agreements) — confirmed test data, so these
  go with the rest.

This pass is **irreversible**, so it is its own release, with nothing else in it.

### Pass 5 — Prove it
A full pass with screenshots of every screen that survived, the whole test suite, and
then one founder walkthrough.

---

## What order this sits in, against the other work

Recommended, and the reason:

1. **The two blockers first** — publishing is broken, and a creator cannot negotiate.
   Both are on the KEEP list, both are already broken, both are small.
2. **Then the cleaning**, Passes 0–4.
3. **Then finish the spine** to a signed contract.
4. **Then the walkthrough.**

**Cleaning before building, deliberately.** Roughly 80 of the 142 audit findings sit in
code that is about to be deleted. Fixing them first would be paid work thrown away, and
building new features on top of three abandoned businesses is what produced this
situation in the first place.

---

## The rule from here

Per `Docs/THE_FINISH_LINE.md` Rule 1 and Rule 2: **this document is the design of record
for scope.** If a change is wanted, this document is updated first and the founder
confirms it, and only then does code change.

Anything found in the code that is not on the KEEP list is not a feature. It is something
that has not been deleted yet.
