# The 12 agreed mockups — read in full, checked against the running system

**2026-08-20.** All twelve read end to end. Every load-bearing claim in them then checked
against the code on both phones, the live server, and the production database.

Nothing here changes the plan on its own. It is what I found, so you can decide.

---

# PART 1 — What the twelve are, and which ones win

They were written across an evolution, not at one sitting. Four of them **contradict** the
others, because the later ones applied your changes. You told me the conclusion was the
ledger plus FINAL 1–4. That is the right call, and it settles all four contradictions.

| # | File | What it is | Standing |
|---|---|---|---|
| 7 | `03-action-ledger.html` | **160 actions, both apps, in order.** The governing list | **Authoritative** |
| 8 | `final-1-creators.html` | Actions 1–58 — controls, Creators tab, conversation, diary | **Authoritative** |
| 9 | `final-2-campaign.html` | Actions 59–98 — campaign creation, every step and branch | **Authoritative** |
| 10 | `final-3-delivery.html` | Actions 99–160 — sign, shoot, posts, social, completion, money | **Authoritative** |
| 12 | `final-4-drilldown.html` | The running half — campaign → set → creator → six steps | **Authoritative** |
| 11 | `04-tab-arrangement.html` | All 160 actions assigned to a home tab, both apps | **Authoritative** |
| 3 | `navigation.html` | The creator's six-step spine | **Authoritative for the creator**, superseded on the brand app |
| 1 | `conversations.html` | The creator's invitations and pitches, in detail | **Authoritative for detail**, superseded on the stage list |
| 2 | `shoot-and-content.html` | The shoot, the parcel, the ordering rule, completion | **Authoritative for detail**; FINAL 3 is the summary |
| 4 | `visibility.html` | Step diary, per-collaboration money, catalogue, her posts | **Authoritative for detail**, superseded on the place picker |
| 5 | `brand-mobile.html` | First brand-phone draft | **Superseded** by v2 |
| 6 | `brand-mobile-v2.html` | Your changes applied | **Superseded** by FINAL 1–4, which are its detail |

## The four contradictions, and what wins

**1 · Does the brand phone get a Creators tab, and campaign creation?**
`navigation.html` and `brand-mobile.html` say **no** — "no new brand tab", "campaign creation
stays web-only, per locked scope".
`brand-mobile-v2`, `tab-arrangement` and FINAL 1/2/4 say **yes** — Alerts swaps out for
Creators, and the full campaign wizard comes to the phone.
→ **The later ones win.** Only one desk job is left: adding and pricing products.

**2 · Five stages or six on the creator's Collabs tab?**
`conversations.html` draws five: Invitations · My pitches · To sign · Active · Tracking.
`navigation.html`, `tab-arrangement` and FINAL 1 all say six: **Invitations · Pitches ·
To sign · Shoot · Content · Done**.
→ **Six wins.** It also matches your programme document.

**3 · Working style — three options or two questions?**
`brand-mobile.html` offers three: store visit / we ship / remote.
v2 and FINAL 1 split it into two questions: **where does she shoot**, and **are you sending
products**.
→ **Two questions win.** This was a deliberate decision recorded in v2 — three options forced
a choice between things that are not alternatives, and it would have orphaned the parcel flow.

**4 · The place picker — nearby towns, or a city list?**
`visibility.html` wants state → city → **nearby towns**, with distances, and says a place list
has to be built from scratch.
FINAL 1 and v2 want a **searchable state→city multi-select with a live creator count on every
row**, zero-count rows greyed.
→ **The finals win — and this is cheaper.** The count-driven list already exists and the web
app already uses it. No place list, no distances, no new data.

---

# PART 2 — Where the ledger's own status flags are wrong

The ledger marks every action *works · needs UI · changes · new · remove*. Those flags are the
plan's cost estimate. They are also a document, so I checked them.

## Smaller than the ledger says

| Ledger | Says | Actually |
|---|---|---|
| **6–11** Brand's six pitch settings | "needs UI · no screen anywhere" | **Already have a screen — on the phone AND the web.** All five filters plus the on/off switch. **Six actions come off the list.** |
| **46** Creator counters her own pitch | "new — the one missing direction" | **The server shipped it.** The route, the round limits and the diary entry all exist. **No app calls it.** App-side only. |
| **19–27** Groups, ask a group, ask many | "needs UI" | Correct for the phone. On the **web** it is nearly complete — groups have a full management screen, and the composer already handles a group or a filter. Not our scope now, but every shape is proven and the server is exercised. |

## Bigger than the ledger says

| Ledger | Says | Actually |
|---|---|---|
| **50** The diary | "new · hard dependency" | Correct, and **worse than stated.** The table exists and every ask/counter/accept writes to it — but there is **no way to read it**: no endpoint, no screen. `GET /collab-threads`, which the conversations contract specified as its own slice, was **never built**. And it holds **0 rows** in production. |
| **150–152** What a collaboration paid her | "new · the cheapest real win — arithmetic over data you already keep… real stamped sales in production" | **This is wrong, and it is the most important error I found.** Production holds **6 transactions**. **Zero** carry a creator, a campaign, or a post. Total commission: **₹0**. There is nothing to add up. The screens can be built; they will be empty on every account, and they **cannot be functionally tested** until attributed sales exist. |

## Confirmed exactly as claimed

- **No shoot screen or route in either app's navigation.** Eight production endpoints are live
  and none of them is reachable. One shoot exists in production, stuck at "proposed".
- **No way to open a post.** The creator can list her posts and nothing else — there is no
  post-detail endpoint.
- **The two tracks do not know each other exists.** Zero references to shop posts anywhere in
  the deliverable code, so the shop-before-Instagram rule genuinely has nothing to build on.
- **Rejections are free text**, so "quality only" is unenforceable and faults are uncountable.
- **The media library is an extension, not a new build.** The table exists, holds 0 rows, and
  is switched off behind a flag.
- **Product categories are already there** — 92 products, all 92 carry a category label, 80 sit
  in the proper tree. The screens were simply never sent the label. Cheapest item on the list.
- **28 brands, exactly 1 accepts pitches.** The creator's whole outbound route points at one
  restaurant. Unchanged since the mockups were drawn.

---

# PART 3 — The problem nobody has named yet

**Almost nothing in this programme has ever been run, and you test functionally.**

| What | In production |
|---|---|
| Brand requests to creators | **2** — neither ever opened; both expire this week |
| Creator pitches to brands | **0** |
| Saved groups | **0** |
| Settled agreements | **0** |
| Diary entries | **0** |
| Contracts | **1** |
| Shoots | **1**, stuck at "proposed", never confirmed |
| Shop posts | **1** |
| Deliverables | **1** |
| Sales attributed to a creator | **0** |
| Creators who can be contacted | **29** (of 73 findable — the other 44 have no account) |
| Fashion creators in Vijayawada you can contact | **1** |

Every "works today" in every mockup means **the code path exists and is wired** — not that
anyone has ever walked it. The shoot mockup says this outright and it is true across all 160
actions.

**What this means for you.** Nine stages of functional testing against a world holding one
contract, one shoot and zero attributed sales will not work. Stage 8 in particular — the
numbers — has no numbers to show. This needs deciding **before** implementation, not during
stage 8.

Three ways out, and it is your call:

- **Seed a test world.** Build a realistic set of creators, brands, agreements, campaigns,
  shoots, posts and attributed sales up front. Most work, most reliable, tests everything.
- **Walk it forward yourself.** Each stage's test creates the data the next stage needs. No
  extra build, but one broken link stalls everything behind it, and you cannot re-test a stage
  without re-walking it.
- **A mix** — seed the slow parts (sales, posts), walk the human parts (asking, negotiating).
  My recommendation.

---

# PART 4 — Two hard dependencies the nine-stage plan does not mention

Both come from the ledger itself, and both are named as "build this before its screens".

**1 · The diary must exist before any history screen, on either app.**
Only the latest counter is stored — each one overwrites the last. Until the diary is readable,
the step-history page cannot be drawn on either phone, and your own test case ("every offer
that was ever on the table is still visible to both") cannot pass.

**2 · The product picker must be built once, not four times.**
Four separate flows need "choose products, grouped by category, with images": what a creator
may sell, what an offer applies to, what goes in the parcel, and what she tags in a post.
Built four times, they drift apart.

Neither is a stage in the nine-stage plan. Both are prerequisites inside it.

---

# PART 5 — How the mockups' own build orders compare to the nine stages

Each FINAL file ends with its own build order. Together they are more granular than the nine
stages and, in two places, differently sequenced.

| Stage | Ledger actions | Drawn in | The mockups' own order |
|---|---|---|---|
| 1 · A brand asks a creator | 1–58 | FINAL 1 | diary + counter-back → Creators tab shell → conversation + diary → *(pitch settings: drop, exists)* → Find + place picker → groups + ask group + ask many |
| 4 · A brand runs a campaign | 59–98 | FINAL 2 | product picker → wizard shell + steps 1–2 → step 3 → step 4 → offer builder + preview → review |
| 4 · (the running half) | navigation + roll-up | FINAL 4 | step derivation → needs-you roll-up → sets and creators → brand spine → step links |
| 5 · Shoot and content | 99–142 | FINAL 3 | *(after per-collab money and post detail)* shoot screen → parcel → faults → exclusive notice → ordering rule |
| 8 · The numbers | 143–160 | FINAL 3 | per-collaboration money **first** — the mockups call it the cheapest win |

**Two things worth flagging.** FINAL 3 puts per-collaboration money **first** of everything,
on the grounds that it is free arithmetic — but Part 2 shows there is no data to do the
arithmetic on, so its cheapness is not real. And FINAL 4's first two slices — the step number
and the needs-you count, both **server-side** — are the spine that four other stages read.
They belong very early, and no stage currently owns them.

---

# PART 6 — What I am not yet sure about

- **The two attached files came through empty.** `understood initial plan.txt` and
  `Follower programme plan.txt` both contain nothing. I have never seen the follower programme
  in its own words — only the merged nine-stage summary. **Stages 2, 3, 6 and 9 are follower
  work, and I have not verified them against anything.**
- The 160 actions cover brand and creator. **The follower app's own actions are not in the
  ledger.** If the follower work has an equivalent list, I have not seen it.
- Three decisions the tab-arrangement records as still open: whether approved brands should
  accept pitches by default, whether the publishing gate fires on one live shop post or all,
  and extend-vs-rebuild for the media library.
