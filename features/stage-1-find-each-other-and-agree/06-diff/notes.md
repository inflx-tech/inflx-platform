# Before / after — Stage 1

Written 2026-08-25, later than it should have been. Stage 1 shipped without this file and
the gap only surfaced when a defect fix touched the contract again. The block was correct.

## What the stage promised, and what shipped

| Promised | Shipped |
|---|---|
| Search creators in AP/TG, see counts per city before picking | Yes — three filters (Where · Works in · Size), each a picker; places carry live counts |
| Save a set as a group | Yes — `influencer_groups`, two groups in production |
| Ask them all in one move | Yes — from Find and from a group |
| An honest answer on who was reached and why not | Yes — skipped reasons returned per creator |
| The request on the first screen of her Collabs, with a badge | Yes |
| Both sides counter; every offer stays visible | Yes — `collab_events` and a shared history page |
| Six stages, always visible | Yes |
| Brand gains a Creators tab | Yes — Alerts replaced |
| Approved brands open to creator pitches | Done 2026-08-23 on the founder's explicit go |

## What diverged

**The reach numbers were smaller than planned.** The stage was written against 28 brands.
The dummy data was wiped on 20 August, so "27 brands to open" became **3**. Same work,
smaller world.

**Pitch settings were dropped from scope** after the reality check found them already on
the phone. That was correct at the time, but incomplete: they exist under
*Profile → Influencer Proposals* with the control labelled "Filters", which is not where
anyone looks for "who can approach me". Moving them into the Creators tab is now queued.

**The history page is empty for the eleven practice conversations.** Recording started
after they were created, so they genuinely have no history and the page says so rather
than showing a blank box. It fills from the next move anyone makes.

## Defects found after release

**1 · The creator's whole outbound route was dead** (fixed 2026-08-23).
`GET /influencers/me/discover-brands` returned 500 in its default state — no filters,
which is how the screen opens. `discoverEligibleBrands` passed `influencerId` as `$1` and
never referenced it, so Postgres rejected the statement. Three filter placeholders had
also lost their `$`. **"Find brands to pitch" had never worked for anyone.** Found by
verifying that opening brands to pitches actually reached her screen, rather than treating
the database change as the change.

**2 · "Add creators" to a group opened the wrong screen** (fixed 2026-08-25).
`BrandGroupDetailScreen` navigated to `BrandInfluencerBrowse` — the old creator search —
passing `addToGroupId`. That screen has never heard of groups, ignored the parameter, and
opened a profile on tap. The screen that understands the mode is `BrandFindCreators`,
built in this same stage.

Sweeping for the cause found something larger: **the `BrandFindCreators` route was never
navigated to by anything.** The Find screen works only because it is rendered inline
inside the Creators tab. So the app carries two creator search screens, and the one place
that needed the new one used the old one. With the fix, `BrandInfluencerBrowse` has no
entry point left and should be retired — two search screens is how they drift apart, and
this defect was that drift.

## What to check on a handset

1. Creators tab shows Talking · Agreed · Find · Groups, opening on whoever owes you a move.
2. Find and Groups render **inside** the tab, not behind a second tap.
3. Filtering Where → Vijayawada returns four creators, each row leading with INFLX following.
4. Groups → open a group → **Add creators** → rows **tick**; they must not open a profile.
5. "Add to group" appears once anything is ticked, and the members appear on return.
6. Ask a whole group; the result names who was skipped and why.
7. The request reaches her on the first screen of Collabs, with a badge.
8. Counter from her side; the conversation moves to the brand's turn.
9. "What happened here" shows the same moves, in the same words, on both sides.

## Evidence

Mobile suite 159/159. Duplicate-route check clean across all 14 stacks. Android bundle
builds. Backend: certified no-regression against the 93-failure baseline at release
(24 suites / 93 failures identical before and after; passing up by exactly the 9 checks
the stage added).

**Not claimed green** — the repo carries 93 pre-existing failures, and the full serial
suite has not been runnable since 22 August.

---

# Creators tab pass — 2026-08-25

Founder: *"keep this influencer proposals in creators tab, it is not new right ..all this
is actions before making detailed campaign"*, then *"take your best decision on this UI/UX"*.

## The decision: four sub-tabs, not five

Talking already holds **both directions** — requests out and pitches in — sorted by whose
turn it is. A fifth Pitches tab would show the same conversations twice, and five labels
across a phone start truncating.

What was missing was never a tab. It was **a way in and an honest name.**

## What changed

**"Who can pitch you" now sits at the top of Talking** — where the approaches actually
arrive. It states the current position in words (*open to anyone* / *open with conditions*
/ *closed — no creator can approach you*) and opens the existing settings sheet.

It used to live under **Profile → Influencer Proposals**, behind a control labelled
**"Filters"**. That word reads as *show me fewer of these*, not *decide who may reach me*.
Two very different things wearing the same label.

**Bulk send announces itself.** The control read **"Select"** — a mode name, not an
outcome — as a small link beside "Clear". It now reads **"Ask several"**, so the screen
says what it can do before you have selected anybody.

**The old creator search is retired.** With the group flow re-pointed, the Home tile was
its last entry point; that tile now opens the Creators tab. `BrandInfluencerBrowse` is
gone from the navigator.

## Two mistakes caught while doing it

**I claimed the old screen had no entry point left. It did.** My grep looked for
`navigate('BrandInfluencerBrowse'` and missed the Home screen, which reaches it through a
`target:` property instead. Removing it from the navigator first would have left a Home
tile pointing at nothing. Found by grepping the name rather than the call.

**Three style tokens did not exist** — `fonts` is not imported in that screen at all, and
neither `ig.sunk` nor `ig.white` are real (`ig.bg` is). The `fonts` one would have thrown
at module load: a fault that builds cleanly and dies on the handset. Now checked
mechanically — all 12 `ig.*` tokens in that screen resolve, and all 11 Home tiles point at
registered routes.

## Evidence

Mobile 159/159 · duplicate-route check clean across all stacks · Android bundle builds ·
every `ig.*` token resolves · every Home tile resolves.
