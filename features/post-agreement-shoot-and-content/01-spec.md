# Post-agreement — the shoot, the content, the finish

**Source:** founder's end-to-end walkthrough and the 62-item finalised list, handed over
2026-08-15 from a prior conversation. Parts A (the shoot), B (content, in order), C
(completion), D (the travelling kit).

**Position:** everything up to and including contract signature is covered by
`collab-part2-precampaign-handshake`, `collab-part4-offers-allocation`,
`collab-part5-sales-aim-separation` and `collab-part6-creator-side`. This contract begins
the moment the contract is signed and ends when the collaboration is complete. The sale
itself is the follower app, and is explicitly next, not here.

---

## 0. Audit — every "works today" claim checked

The founder's read was *"almost everything before the shoot exists but is hidden inside the
campaign, and almost everything after the shoot exists but nothing connects."* That is
accurate. Three items need correcting, and one of them makes a 🆕 item smaller.

### 0.1 Confirmed as claimed

| Claim | Evidence |
|---|---|
| Shoot plan auto-created on signature | `contract.controller.js:478` → `productionService.autoCreateForContract` |
| Three modes | `VALID_MODES` in `production.service.js` |
| Propose / counter / accept / flip-to-remote / complete | Six live routes in `production.routes.js` |
| Two reschedules per side | `RESCHEDULE_LIMIT_PER_SIDE`, enforced on both counters |
| Visit finishes 2 days before posting, worked backwards | `getVisitDateRange` — `posting_date − 2d`, falling back to `content_end_date − 3d`, then `campaign.end_date − 3d`, then a deliberate 1-year ceiling for the open-ended sales campaigns Part 5 introduced |
| Admin production queue | `GET /admin/production/queue` |
| Social chain: submit → review → post → confirm-live → auto-scrape | `deliverable.routes.js`, incl. `refresh-stats` |
| No wallet, escrow or payment stage in the sales track | Confirmed absent |

### 0.2 Correction 1 — the media library is not greenfield

**Item 42 is listed 🆕. It is closer to 🔄.** Migration 136 already created
`creator_assets`: `r2_key`, `media_type`, `aspect`, an approval state, and foreign keys to
**both** `campaign_influencer_id` and `deliverable_id`. Its own comment reads *"approved
creator photos, reusable across experiences."*

- **0 rows in prod** — no backfill, no migration risk.
- Flag-gated behind `CREATOR_IMAGERY`, default off. Inert today.
- One consumer, `creatorImagery.service.js`, built for per-context product imagery rather
  than shoot footage.

So the media library is an **extension of something already designed for reuse**. Whether
to extend it or build beside it is a real call, not a formality — see §3.3.

### 0.3 Correction 2 — it is buried in the *contract*, not the campaign

Production renders inside `ContractScreen.js` (creator) and `BrandContractScreen.js`
(brand). There are **zero production routes in either navigator**. This makes item 7
slightly larger than "move a screen": there is no screen to move, and no destination a
notification can deep-link to.

### 0.4 Correction 3 — the whole surface has run exactly once

| Table | Production rows |
|---|---|
| `production_events` | **1** — mode `visit`, status `proposed`; never confirmed, never completed |
| `contracts.production_mode` | 1 — `visit` |
| `creator_posts` | 1 — `approved` |
| `deliverables` | 1 — `live` |
| `creator_assets` | 0 |

"Works today" here means the code paths exist and are wired — **not that they have been
exercised**. Every ✅ below should be read as code-verified and field-unproven. The first
real run will find things.

### 0.5 The new work, confirmed by absence

| Item | Verified absent |
|---|---|
| Parcel contents + item receipt | No item/parcel/contents column in migration 024 or 039 |
| Shop-live-before-social ordering | **Zero** references to creator posts in `deliverable.controller.js` — the tracks do not know each other exists |
| Brand notified on an exclusive post | `creatorPosts.service.js` notifies **the creator only** |
| Fixed rejection reasons | `reject` takes free-text `req.body.reason` → `reject_reason` |
| Completion picture | Nothing computes completion across the two tracks |

---

## 1. Part A — the shoot

### 1.1 Changes to what exists

| # | Change | Where |
|---|---|---|
| 3 | Mode is settled at the handshake, removed from contract signing | `contracts.production_mode` stops being set at brand-approve (`contract.controller.js:1088`, whose comment says it is picked there "so the influencer sees it before signing" — which is precisely the problem: seeing is not agreeing). Read from the agreement's terms instead. |
| 4, 5 | Negotiable, never dictated, not mandatory | Falls out of #3 — the handshake negotiates every term it carries |
| 6 | `visit_window_minutes` becomes **expected time** | Same column, honest label and copy. Not a slot she can be late for. |
| 7 | Its own screen and route on both apps | New. Creator: the shoot for this collaboration. Brand: one list across every creator — `GET /campaigns/:id/production` already returns exactly this and nothing renders it. |

### 1.2 New — what is in the parcel (items 20, 21)

New table `production_event_items`: event, **product**, variant, quantity. Items are picked
from the brand's catalogue, not typed, so the parcel and the products she can later tag in a
post are the same rows — which also makes "did the parcel ever get shot?" answerable.

On arrival she confirms item by item: `received` / `missing` / `damaged`, each timestamped.
The existing `shipment_received_confirmed_at` stays as the overall marker. A shortfall
notifies the brand with the item named.

**A missing item never blocks her shoot or her posts.** She shoots what arrived.

### 1.3 Not building

Item 8 — no shoot brief. The brand does not specify what to shoot.

---

## 2. Part B — content, in order

### 2.1 The review desk cannot creep (items 28, 29)

"Reject on quality only" is policy today and unenforceable, because the reason is a
free-text box. It becomes a **closed list of technical faults**: blurred · unusable video ·
too dark · product cropped · resolution below minimum · watermark or another brand visible ·
tagged product is not the one shown.

Free text is allowed only *alongside* a listed fault, to help her fix it. It cannot stand
alone. There is deliberately **no reason about concept, styling, product choice or post
count**. This also makes rejections countable.

Item 33: the creator sees "with our review team since {timestamp}" — a wait with a clock is
a queue, a wait without one is a void.

### 2.2 Who gets told (items 30, 31)

Exclusivity is computed from the tagged products at approval: exactly one distinct brand →
notify that brand; more than one → notify nobody. Approval currently notifies only the
creator, so this is one branch on an existing path.

### 2.3 The ordering rule (items 38–41) — the substantial new mechanic

- **38** — `submit-live` refuses while the creator has **zero live shop posts** for this
  collaboration. Server-side; a UI-only gate is a suggestion.
- **39** — the unlock is announced in the founder's words: *"Your shop posts are live — you
  can post on Instagram now."*
- **40** — brand review of the reel and admin review of the shop posts run **concurrently**.
  Neither queue waits for the other. Only publishing is ordered.
- **41** — one agreed deadline covers both, in that order.

**Threshold — a judgement call, flagged.** The gate is *one* live shop post, not all of
them. Requiring every post to clear review would let one slow review hold her Instagram
hostage, and the rule exists only so traffic lands somewhere. One live post satisfies that.
Say if you want all.

**Engagement collaborations are exempt** — there are no shop posts in that track, so the
gate must not accidentally block a paid reel. This needs an explicit test, not an intention.

### 2.4 One media library (item 42)

Per §0.2, an extension. **Recommended: extend `creator_assets`, with the approval state made
optional** — shoot footage enters `pending` and is usable in a draft immediately; approval
stays meaningful only where `CREATOR_IMAGERY` is switched on. This does couple the work to a
parked program, which is the reason it is your call and not mine.

### 2.5 The brand's expectation (items 43, 44, 46, 47)

"We'd love 5 posts across concepts" rides the handshake terms model as a **preference**, on
sales campaigns only. It is an intention, never a debt, and nothing enforces the number.

A post counts as delivered **when it is approved**, not for as long as it stays visible. If
the brand runs out of stock, raises a price, or lets an offer expire and the post goes dark,
the creator does not become non-compliant. **Completion is computed from the approval event,
never from current visibility.**

---

## 3. Part C — completion (items 56–59)

| Track | Complete when |
|---|---|
| Sales | shoot done · **≥1** shop post approved and live · social post live and brand-confirmed |
| Content | deliverables live and confirmed · payment stages released |

One screen per collaboration, showing where it stands. The brand's hoped-for number shows as
guidance — *"3 posts · they hoped for 5"* — and gates nothing.

The sales completion screen must never grow a money bar because the content one has one:
there is no wallet, no escrow and no payment stage in the sales track, and she earns only
when someone buys.

---

## 4. Part D — the travelling kit (items 60–62)

**Later, and it should stay later.** Four of the five open questions live here and they are
commercial and legal, not design. The mockup carries a sketch and stops.

---

## 5. Open questions

| | Question | Status |
|---|---|---|
| **A** | Cold invites have no handshake — where is the shoot mode settled? | **Assumed**: the shoot screen's first step, negotiable, asked once — the answer already proposed. Designed to it. Say if it belongs elsewhere. |
| B | Who pays the courier creator-to-creator? | Open — blocks Part D |
| C | Who is liable if the kit is lost between two creators? | Open — condition photos at each handover would give a record |
| D | Ship-onward deadline so creator B is not blocked? | Open — blocks Part D |
| E | A creator drops out mid-chain holding the goods? | Open — blocks Part D |

**Only A touches Parts A–C, and it is assumed rather than blocking.** B–E block Part D
alone. Parts A, B and C can be locked and built without any of them.

---

## 6. Tally

30 items already work · 7 change · 18 to build · 4 deliberately not built · 3 later.

The build concentrates in five places — the **parcel**, the **ordering rule**, the
**notification**, the **reasons list** and the **completion picture** — plus the screens to
put them on. Everything else is exposing and sequencing what already exists.

---

## 7. Slices

| # | slice | targets |
|---|---|---|
| A1 | Shoot mode moves to the handshake; expected-time relabel | backend, brand-web, Mobile |
| A2 | The shoot screen + route, both apps | Mobile (creator + brand) |
| A3 | Parcel contents + item-by-item receipt + shortfall notice | migration, backend, Mobile |
| B1 | Fixed rejection reasons + "with our review team" | backend, admin-web, Mobile |
| B2 | Exclusive-post notification to the brand | backend |
| B3 | The ordering rule, server-side, with the engagement exemption | backend, Mobile |
| B4 | Media library — extend `creator_assets` | backend, Mobile |
| C1 | Completion computation + one screen per track | backend, Mobile |
| D | The travelling kit | **blocked on B–E** |

`02-workflow.md`, `03-expected-outputs.md` and `05-impact.md` follow the mockup lock — the
founder asked for analysis and mockups first, and sizing the rest before the shape is agreed
would be guessing.
