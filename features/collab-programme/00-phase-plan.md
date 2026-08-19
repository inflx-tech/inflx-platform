# The collaboration programme — phase plan

Written before implementation, in plain language. Every phase below becomes its own contract
in `features/<slug>/` with a spec, a workflow, expected outputs, an impact note and a lock —
the pipeline `gov-check` already enforces.

The mockups are done: the action ledger (160 actions), FINAL 1–4, and the tab arrangement.
Nothing gets built that isn't a row in the ledger.

---

## Before anything — three decisions

**Founder, 2026-08-15. A and B are settled. C is deliberately left until Phase 7 opens.**

| | Decision | Blocks | Answer |
|---|---|---|---|
| **A** | Should approved brands be open to creator pitches by default? | Phase 3 | ✅ **Yes — they are pitchable.** Approved brands become reachable by default, with the per-brand switch and the five pitch filters still theirs to set. This is outward-facing: 25 brands go from unreachable to reachable in one migration, and some will first notice via a pitch notification. |
| **B** | Does the Instagram hold lift on **one** live shop post, or **all** of them? | Phase 7 | ✅ **One live post is enough.** The rule exists so traffic lands somewhere; one satisfies it. A slow review on a second post can never hold her Instagram hostage. |
| **C** | Media library — extend the existing asset store, or build beside it? | Phase 7 | ⏸ **Deferred to Phase 7.** Decided when we get there, not now. |

### What decision A commits us to

- One migration flipping approved brands to pitchable. Reversible per brand, and reversible
  wholesale if it goes badly.
- A brand who suddenly starts receiving pitches **already has the controls** to turn them
  off and filter them, on both the phone and the desk. Nothing needs to land first.
  *(Corrected 2026-08-15 — I had recorded these as missing.)*
- It is the only outward-facing change in the whole programme — worth its own line in the
  deploy note rather than riding in quietly.

---

## Phase 0 · Foundations nobody sees

**What changes.** Five things everything else stands on. No screen changes at all.

- A **diary** for every step. Today only the latest counter survives — each one overwrites
  the last — so no history screen can be drawn on either app until this exists.
- **One step calculation, on the server.** The number that says "step 3 of 6" must come from
  one place, or the brand's screen and the creator's screen will eventually disagree about
  the same collaboration.
- **One needs-you count, on the server.** Same reason. A badge computed twice is a badge that
  stops being trusted.
- **The creator can counter back on her own pitch.** The one missing direction. Today a brand
  can counter her forever and her only replies are accept or walk away.
- **Three corrections** that the above arms: brand acceptance must settle the *latest* terms,
  the brand's counters get the same round cap the creator has, and a creator can't accept her
  own counter.

**Final output.** Nothing visible. Every step starts recording who did what and when, and both
apps can ask the server what step a collaboration is on and how much is owed.

**Layers.** Database — one new table, three new columns. Backend. No app changes.

**Safe for phones that haven't updated.** Yes. Additive only, and the corrections fire only in
states no shipped app can currently produce.

**How we'll know it works.** Play a negotiation through — 15% asked, 22% countered, 18%
settled — then read the diary back. All three offers must be there; today two of them vanish.
Each of the three corrections gets a check that fails before the fix.

**Not in this phase.** Any screen.

---

## Phase 1 · Small things people notice immediately

**What changes.** Three unrelated wins that need nothing from Phase 0 and nothing from each
other.

- **What each collaboration paid her.** She can see ₹14,000 today; she cannot see that ₹9,000
  came from Kanchi Silks and ₹5,000 from Label Fern. The brand can already see its side of
  exactly this.
- **Products carry their category everywhere.** All 92 products are labelled and not one screen
  is sent the label, so everything is a flat list. Fixing the three places that serve products
  fixes browsing, campaign scope and her shelf at once.
- ~~**The brand can set who may pitch them.**~~ **REMOVED 2026-08-15 — it already exists.**
  On checking the apps rather than trusting my own earlier note, a brand can already turn
  pitches on and off and set all five filters, on both the phone and the desk, and it has
  its own contract. I had recorded it as missing in four places and not one of those was
  checked against the apps. Corrected everywhere. **Phase 1 is two items, not three.**

**Final output.** She opens a collaboration and sees what it paid, which products sold and
which post sold them. Anyone looking at products sees them grouped by kind.

**Layers.** Backend for the money grouping and the category fields. Both apps for the screens.
No database change.

**How we'll know it works.** Six real attributed sales already exist in production — the
per-collaboration figures must add up to the lifetime figure she already sees. A product list
must actually return its category in the response, not merely have it in the database.

**Not in this phase.** Any navigation change.

---

## Phase 2 · The creator's Collabs tab

**What changes.** Her whole working life moves into one tab with six stages: Invitations,
Pitches, To sign, Shoot, Content, Done. Nine stages become six — three of today's are derived
states she never sees, and one can never be non-empty at all.

Inside a collaboration she gets the spine — the six steps as the navigation — plus a Needs-you
screen, the conversation, and the diary from Phase 0.

The old Brand Proposals row under Profile is retired. **That row is the original bug:** a real
request sat unseen behind three taps.

**Final output.** A brand asks her, and it appears on the first screen of Collabs with a badge.
She can see every offer that was ever on the table.

**Layers.** Influencer app only, plus the reads from Phase 0. No database change.

**How we'll know it works.** The production request currently sitting unseen for Sagar Joshi
appears under Invitations without entering Profile — and the "not yet seen" flag on it finally
flips, which it never has.

**Not in this phase.** The shoot screen, posts, completion.

---

## Phase 3 · The brand's Creators tab

**What changes.** A new tab replacing Alerts, holding everything before a campaign exists:
searching creators, saved groups, asking one or many, and every conversation in both directions
until a campaign is drafted.

**Ten of these have a finished backend and no screen on any surface** — groups, bulk-add, asking
a group, broadcasting, and the reach preview. Built, tested, never usable by anyone.

Also here: a list of places, so area filters work on both sides. There is no list of states,
cities or nearby towns anywhere in the system today.

**Final output.** A brand can find fifteen fashion creators near Vijayawada, save them as a
group, ask them all in one move, and see honestly how many were actually reached and why the
rest were not.

**Layers.** Backend for the place list and the filters. Brand app for the screens. One small
database addition for places.

**Blocked on decision A** — filters over a directory of one brand are theatre.

**How we'll know it works.** Send to a filter matching forty-one creators and confirm the screen
reports matched, reachable and capped honestly, with every drop named.

**Not in this phase.** Campaigns.

---

## Phase 4 · Watching a campaign happen

**What changes.** The drill-down: a campaign opens to its sets, a set opens to its creators, a
creator opens to the six steps, a step opens to the thing itself. Work owed rolls up every level
and reconciles at each one.

**Final output.** A brand taps a badge saying 6 and can walk it down to a button, every time,
without ever wondering where a number came from.

**Layers.** Brand app, reading Phase 0's step and count. No backend or database change.

**Device pass required here.** This adds routes to native stacks — the class of change that
passes a bundle build and hard-crashes on a phone. Maestro has been skipped six consecutive
times; this is the phase to stop.

**How we'll know it works.** Every badge equals what is beneath it plus what is owed at that
level. If they do not reconcile on a real campaign, the phase is not done.

**Not in this phase.** Creating campaigns.

---

## Phase 5 · Creating a campaign on the phone

**What changes.** Five wizard steps become four. "Who posts?" goes — it was settled at the
handshake. Picking creators becomes picking from agreements you already hold. Setting terms
splits in two: what the creator gets is read back because it is already agreed, and the only
open decision left is what her followers get.

For a sales set the content question inverts: we stop asking how many posts she must make and
start asking what channels she brings, because she carries the selling and earns only if it
works.

Plus one shared product picker — four different flows need "choose products, grouped by
category, with images", and building it four times is how they drift apart.

**Final output.** A brand with three agreed creators can build and publish a campaign from a
phone. Only one desk job remains: listing and pricing products.

**Layers.** Brand app mostly. Backend for the aim filter and the basket preview. No database
change.

**How we'll know it works.** Build a two-set campaign end to end on a phone, change one agreed
term, and confirm the creator is told which term moved, by name.

**Not in this phase.** The shoot.

---

## Phase 6 · The shoot

**What changes.** The shoot gets its own screen on both phones — today it is a section inside
the contract page with no route, so a notification has nowhere to point.

Working style moves to the handshake and becomes two questions instead of three options: where
does she shoot, and are you sending products. Shipping stops being a confusing third peer and
becomes what it actually is — a consequence of shooting remotely.

New: what is actually in the parcel. The brand lists the three sarees; she confirms them one by
one and flags anything missing, instead of chasing it on WhatsApp. **A shortfall never becomes
her problem** — she shoots what arrived.

**Final output.** Both sides can settle a time, ship goods, confirm receipt and finish the shoot
without leaving the app.

**Layers.** One new table for parcel contents. Backend. Both apps.

**How we'll know it works.** Ship three items, confirm two, flag one. The brand is told which
item by name, and her shoot is not blocked.

**Not in this phase.** Posts.

---

## Phase 7 · Content, in the right order

**What changes.** Four things, and one rule.

- **Rejections become a fixed list of technical faults.** "Quality only" is a policy today, and
  a free-text box is how policies quietly stop being true. It also makes faults countable.
- **The brand is told when a post uses only their products.** Mixed-brand posts tell nobody,
  because telling one brand reveals the other.
- **She uploads shoot footage once** and uses it for both the shop post and the reel.
- **The rule: she cannot publish to Instagram until a shop post is live**, or the traffic lands
  on an empty shelf. Both reviews still run at the same time — only publishing is ordered, so
  she is never queued twice. Content collaborations are exempt, and that needs its own check or
  a paid reel gets blocked forever.

Also: opening a post. She can list her posts today and that is the entire capability — there is
no way to open one.

**Final output.** The two halves of her content work finally know about each other.

**Layers.** Backend for the gate and the notification. Admin for the fault list. Both apps.

**Blocked on decisions B and C.**

**How we'll know it works.** With no shop post live, publishing is refused by the server — not
merely hidden in the app. With one live, it is allowed. On a content collaboration it is never
blocked.

---

## Phase 8 · Finishing, and the numbers

**What changes.** Something finally computes whether a collaboration is done, differently per
track. The brand's hoped-for post count shows as guidance and gates nothing. **A post going dark
later never makes her non-compliant** — it counted when it was approved.

The brand gets its analytics cut four ways — overall, by creator, by product, by post — and its
catalogue by category with what actually sold. The privacy line holds: a mixed-brand post stays
invisible to both brands.

**Final output.** Both sides can answer "is this finished, and what did it produce".

**Layers.** Backend for the computation and the cuts. Both apps.

**How we'll know it works.** A collaboration with the shoot done, one post live and the social
post confirmed reads Complete. Take a product out of stock so a post goes dark — it still reads
Complete.

---

## Deferred, deliberately

| What | Waiting on |
|---|---|
| **How shop posts perform** — views, taps, saves | Nothing sends these signals and nothing can read them. Two jobs before a screen, and until then an honest "we're not counting yet", never a zero. |
| **The travelling kit** — goods moving creator to creator | Four commercial questions: who pays the courier, who is liable if it is lost, how long creator A has to send it on, and what happens if someone drops out holding the goods. |

---

## The order, and why

Phase 0 first because five later phases read from it. Phase 1 next because it needs nothing and
shows up immediately. Then the creator's tab, the brand's two tabs, then the work itself in the
order it actually happens.

**Phases 1 and 2 can run alongside each other. So can 3 and 4.** Everything else is sequential.

## What each phase must produce before a line is written

1. What we are changing, in this language
2. What the final output is — what a person can do afterwards that they cannot now
3. Which layers move: database, backend, which app
4. What we are deliberately **not** doing in this phase
5. How we will prove it works, as a thing to try rather than a test name
6. Deploy class, and whether the backend stays safe for phones that have not updated
7. **A screen re-check, immediately before any screen is built** — founder's addition,
   2026-08-15

### 7 · The screen re-check

Before the first screen of a phase is written, we go back to its mockup and restate, in
plain language, **what we are actually about to build** — screen by screen, control by
control.

Not a re-design. A read-back. The mockups were drawn over several weeks and against a
moving picture; the gap between "this looked right when we drew it" and "this is what we
are building on Tuesday" is exactly where things get built slightly wrong. The re-check
closes it while changing nothing is still cheap.

Applies to every phase that touches a screen — 1 through 8. Phase 0 has no screens, so it
skips this.
