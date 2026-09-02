# WHAT EXISTS — the whole platform, in plain language

**Written 2026-09-02**, after the founder asked: *"give me entire our platform relationship
with backend, db, frontend... how much dead code is there... give me functional
description of it and ask me which feature you want, which one do i need to remove."*

This is a companion to `Docs/AUDIT_2026-09-02.md` (what is broken) and
`Docs/THE_FINISH_LINE.md` (how we work from here). This one is simply: **what is there.**

Written for a reader who does not code. No file names, no table names, no jargon.

---

## THE MOST IMPORTANT FACT, FIRST

**No real money has ever moved through this platform.**

Checked directly against the live database:

| | Count |
|---|---|
| Wallet top-ups, ever | **0** |
| Total money in all brand wallets | **₹0** |
| Creator withdrawals, ever | **0** |
| Shopper orders | 16 — all test data, confirmed dummy by the founder |

Everything below that sounds alarming is therefore **a thing to fix before launch, not a
thing losing money today.** Nobody is being robbed. Nothing is on fire.

**One thing to confirm, though.** The saved copy of the production settings says the
payment system is in *pretend mode* — meaning it would record payments without taking
money. The real setting lives in the hosting dashboard, which cannot be read from the
code. **If pretend mode is on in production, subscriptions would activate without
charging and withdrawals would be marked paid without sending anything.** This is worth
checking before any real customer arrives.

---

## PART 1 — The three pieces, and how they relate

Think of the platform as three things:

**1. The memory (the database).** One central record of everything true: who everyone is,
what is for sale, who agreed what with whom, what money is owed to whom. It never
decides anything; it only remembers.

**2. The engine (the server).** The only thing allowed to change the memory. Every rule
lives here — who may do what, how money is calculated, what happens automatically at
midnight. There is exactly one engine, and everything talks to it.

**3. The faces (the apps and the website).** Four ways in: a phone app for brands, one
for creators, one for shoppers, and a website for brands and for your own staff. **The
faces decide nothing.** They show what the engine says and send back what a person did.

That structure is correct and healthy. The problems found are never in the shape — they
are in there being **too many faces for the same job**, and in **old faces never being
taken down**.

---

## PART 2 — Everything the platform can do

### What a business can do
Sign up and be approved · build a product catalogue (one at a time, in bulk from a
spreadsheet, or by walking down a category tree) · publish it to a shop · build
discounts and deals and reuse them · create a campaign · split it into sets · invite
creators · negotiate money · sign contracts · arrange a photoshoot (a store visit or a
posted parcel) · review the content creators make · confirm a post went live · take
orders, bookings and enquiries · load a wallet · watch money held and released · see what
sold and what it earned · pay for a subscription plan.

### What a creator can do
Sign up, and have her public follower numbers pulled in automatically · be found by
brands · set her own floor (minimum fee, minimum commission, who may approach her) ·
receive invitations · accept, decline, or say the date and shoot style do not suit her ·
pitch a brand herself · sign contracts · arrange the shoot and confirm a parcel arrived
item by item · upload the content · put products on her own shop page · make shoppable
posts · watch her earnings, split into "waiting" and "yours to spend" · withdraw money ·
refer other people and earn from them.

### What a shopper can do
Browse a home feed, shops, creators' shops, categories and offers · follow creators ·
like and save posts · buy for delivery · pay a bill while standing in a shop · book a
table, an appointment or a vehicle · order food by describing it in words · send an
enquiry · request a return · keep a wishlist · leave a review.

### What your staff can do
Approve or reject businesses and creators · verify a creator's identity · moderate the
posts creators publish · **lay out what shoppers see on every screen** (a genuinely
powerful tool — the app's whole front page is arranged from here without shipping an
update) · run outreach to creators and businesses who are not on the platform yet ·
release held money early · approve withdrawals · set every fee and commission rate in
the system · approve returns and refunds · read tax summaries for filing.

### What the platform does by itself, unattended
Fourteen scheduled jobs. The important ones:
- Every night, releases creator commission once the return window has closed.
- Every hour, releases the final half of a creator's fee thirty days after their post
  went live.
- Every fifteen minutes, expires invitations nobody answered.
- Every thirty minutes, closes negotiations where the clock ran out — **and this marks
  the whole collaboration declined, regardless of which side went quiet.**
- Every night, pays businesses their share of shopper sales.
- Every morning, re-checks how each live post is performing.

---

## PART 3 — The money rules, in numbers

These are business facts, not code:

- **Subscription plans:** Free ₹0 · Growth ₹2,499/month · Pro ₹9,999/month ·
  Enterprise ₹29,999/month, plus 18% tax.
- **Campaign fee:** 3% of the budget up to ₹5 lakh · 2% up to ₹25 lakh · 1% above.
- **Sales commission:** 4%–10%, depending on the type of business and whether the sale
  came directly, through a creator's shop, or was credited to a creator by a link.
  Fashion is 10% direct / 5% creator's shop / 7% creator-credited.
- **A creator's fee is released in three parts:** 25% when both sides sign · 25% when the
  brand confirms the post is live · 50% thirty days after that, automatically.
- **A creator earns credit for a sale for 30 days** after a shopper enters her shop.
- **Commission is held for 30 days** (the return window) before it becomes spendable.
- **Withdrawals:** creators, minimum ₹100, 10% tax withheld. Brands, no tax, but a member
  of your staff must approve.
- **Referrals:** 25% of what the platform earns from someone you referred, for 12 months.
  It comes out of the platform's share, not anyone else's.

Two of these need your attention:
- **The 18% tax on your fees is calculated and recorded but never actually charged to
  anyone.**
- **The 10% withheld from creators is recorded, but nothing sends it to the tax
  authority** — it only appears in a monthly summary for someone to file by hand.

---

## PART 4 — How much is dead

### In the memory — the headline number
**140 separate things are remembered. 72 of them have never held a single record — 51%.
A further 13 hold only stale data nothing in the running product touches — 9% more.**

**Six out of every ten things the system remembers are dead weight.**

The live product underneath is small: 129 people · 9 businesses · 48 products · 12
campaigns (8 still drafts) · 6 contracts · 16 sales worth ₹1,65,800. **The most recent
sale was 2 August — a month ago.**

Entirely unused, never once written to: every wallet movement, every escrow lock-up,
every withdrawal, every referral, every invoice, every delivery address, every return,
every wishlist, every booking, and the whole nine-part planned-meal marketplace.

**And one block that was never part of any era:** between 10 and 13 July, 85 records of a
visual design system were seeded — moods, palettes, type styles, page layouts, 24
ready-made shop themes. **No line of code anywhere reads any of it.** It was built and
never connected. Either connect it or drop it; leaving it is the worst of both.

### On the server
Of **585 distinct things the engine can do**, 101 are never asked for by anything.
About 60 of those are legitimate (machines talking to machines, images the server
addresses itself). **That leaves roughly 21 genuinely dead abilities** — built, working,
with no way to reach them.

### In the apps
Of **120 screens**, **14 cannot be opened at all** from anywhere. Including some good
ones: the creator's entire sales list works perfectly and has no door.

### On the website
**Five pages** cannot be reached by clicking. Plus a possible **entire second admin
system** — an older, complete copy pointing at the same live data, last touched
18 August. Whether it is switched on cannot be read from the code.

### The real answer to "how much dead code"
The dead-and-unreachable part is **small** — roughly 5% of the server, 12% of the screens.

**The much bigger number is code that is not dead at all, but belongs to a business you
have left.** The restaurant and food product alone is 21 admin functions, 14 shopper
abilities, a whole dish catalogue, and live screens in both the app and the website. It
is fully working. It is simply not the business you are now in.

**That is the real weight — not dead code, but three businesses running underneath the
one you actually want.**

---

## PART 5 — Where one job is done twice

This is where you and I kept disagreeing about what existed. Each of these is one job
with two implementations, only one of which was ever kept up to date.

| Job | Done twice where | Do they agree? |
|---|---|---|
| **Creating a campaign** | The website and the phone | **No.** The website asks for a posting window and a set-level brief. The phone asks for a single go-live day and a shoot method. Neither knows the other's fields, so a campaign made in one looks half-empty in the other. |
| **Arranging a shoot** | Two screens in the brand app, two in the creator app | No — only one of each pair was fixed. The old creator one still offers switching to remote, which the app tells her one screen earlier she cannot do. |
| **Admin** | Possibly two entire systems | Unknown — needs a check in your hosting dashboard. |
| **Orders** | Two website pages, one unreachable | Same data, two designs. |
| **Enquiries** | Two website pages plus a phone screen | Three different sets of fields for one list. |

---

## PART 6 — Things that are true and worth knowing

**Genuinely well built, for contrast** — so "fix everything" is not the takeaway:

- The pricing engine that decides what a shopper actually pays is used identically by the
  preview and the real till, so the preview can never lie.
- Releasing held money early requires a written reason before the button unlocks.
- The global money settings page refuses to save unless the three release percentages add
  up to exactly 100%, and records who changed them.
- Withdrawal destinations are read from the saved bank record on the server, never taken
  from the app — so money cannot be redirected by a tampered phone.
- Creators' and agencies' bank details are properly scrambled in storage.
- The tool that pulls in a pasted image blocks internal addresses and re-checks on every
  redirect — the best-defended piece of code in the repository.

**Verified as NOT problems**, so they are not re-litigated:
- Yellow is not leaking into the brand and creator apps — the colour token is misleadingly
  named but its value is correct.
- A guest shopper can never see "session expired".
- Every ability the shopper app calls for exists on the server. Nothing is missing.

---

## PART 7 — The things that need a decision

See the companion decision list. In short, you need to answer:

1. Which **businesses** are you in? (Fashion only? Fashion plus furniture? Restaurants?)
2. Which **ways of meeting** survive between brands and creators?
3. Which **money features** are in the first version?
4. Which **shopper actions** are in the first version?
5. For every job done twice — **which one dies?**

Nothing gets built or deleted until those are answered.
