# Test plan — Collaboration Restructure, Parts 1–6

Authored 2026-08-12, after Part 6 deployed. Purpose: prove that everything shipped in
Parts 1, 4, 2, 5, 6 and the dead-offer-join fix actually works — for a brand, for a
creator, and for a shopper.

**Read §1 first.** It says plainly what the existing 386 green tests do and do not prove,
because that gap is the whole reason this plan exists.

---

## 1. Where we actually stand

`pnpm qa` reports **386 passed, gate 0, GREEN**. That is true, and it is weaker evidence
than it sounds. Graded by what each lane really exercises:

| Lane | Files | What it proves | Grade |
|---|---|---|---|
| `qa/web` | 15 | Real pages in a real browser — but with the **API stubbed**, so no server logic and no database | **B** |
| `qa/api` | 2 | Real HTTP against the deployed backend — **unauthenticated paths only** | **B** |
| `qa/unit` (executing) | 10 | Real functions run on real inputs (derivations, terms model, summarisers) | **B** |
| `qa/unit` (source-asserting) | **11** | Reads the source file and checks it *contains* something. Proves the code **says** it, not that it **happens** | **C** |
| `qa/db` | 0 | — | — |

**Grade A — behaviour executed end to end against a real database — does not exist in the
suite at all.** Nothing in the 386 has ever taken a brand from campaign creation to a
creator accepting to a shopper buying.

Eleven of twenty-one unit specs are source-assertions, and they cover the most important
new work: the allocation write path, the campaign rollup, the End action, settled terms,
the dead-offer-join fix. If a wire were disconnected between two files, most of those
tests would still pass.

**Add to that:** five consecutive mobile releases (OTA v163→v168) with no device
verification, and not one commission-bearing sale has ever occurred in production.

So the honest summary is: **the parts are individually well-specified and internally
consistent; the system has never been run.**

---

## 2. The six levels

| Level | What it proves | Who runs it | Needs |
|---|---|---|---|
| **L1** Production data integrity | Live data matches what the shipped code believes | **Me — DONE, results in §3** | nothing |
| **L2** End-to-end on a local database | Real brand → creator → shopper flows, real SQL, no mocks | **Me** | **Docker Desktop started** |
| **L3** Brand web walkthrough | The screens a brand actually uses | Founder (or me, if you log in) | a browser |
| **L4** Mobile on device | Five releases of unverified screens | **Founder only** | Android device |
| **L5** Money path | Commission actually reaches a creator | Founder + me verifying rows | device + a real ₹1 sale |
| **L6** Known defects | Confirm they behave as filed, before they bite | **Me** (L2 environment) | Docker |

L2 is the highest value per unit of effort and it is blocked on one thing: **Docker
Desktop is not running.** Starting it lets me convert most of the grade-C evidence into
grade A without you touching anything.

---

## 3. L1 — Production data integrity · RUN 2026-08-12 · 19/20 PASS

`node qa/scripts/verify-prod-integrity.mjs` — read-only, SELECT statements only.

| # | Check | Result |
|---|---|---|
| P-01 | No live per-creator offer sits on an unpublished product | **PASS** — 0 pairs |
| P-02 | Every offer type is canonical (migration 147 held) | **PASS** — only `discount` in use, 0 non-canonical |
| P-03 | Every live collaboration has an explicit allocation | **PASS** — 19 collabs, 0 on the legacy fallback |
| P-04 | Allocation scopes are values the resolver understands | **PASS** — `products`, 0 unrecognised |
| P-05 | The live-collab discovery chain returns creators | **PASS** — 1 creator discoverable (pre-fix this returned 0 for everyone) |
| P-06 | No contracted creator fails the sell gate | **PASS** — 0 stranded |
| P-07 | Handshake settings row exists and is sane | **PASS** — 1 row, caps 5/12, 2 counters per side |
| P-08 | Every agreement has exactly one source | **PASS** — 0 agreements, 0 bad |
| P-09 | No agreement consumed by two campaigns | **PASS** — 0 |
| P-10 | Creators reachable by default (mute is opt-in) | **PASS** — 29 of 29 reachable |
| P-11 | Part 5 did not rewrite existing campaigns | **PASS** — 10 campaigns, dates intact, 7 live |
| P-12 | No campaign dated by a sales set | **PASS** — 0 violations |
| P-13 | No campaign in an undefined status | **PASS** — `active`, `draft` only |
| P-14 | Brand discovery has real facet values | **PASS** — but **only 1 brand accepts proposals, and 0 have a city** |
| P-15 | Open-campaign applications still unreachable | **PASS** — 0 applications, 0 open-group sets |
| P-16 | No escrow entry in an unhandled status | **PASS** — 0 entries |
| P-17 | No funded campaign the cancel defect could crash | **PASS** — 0 at risk |
| P-18 | Every commission-bearing sale traces to a creator | **PASS** — 6 sales, 0 bearing commission, 0 untraceable |
| P-19 | Offer product lists are mixed-shape (observation) | **PASS** — 128 id strings + 7 whole objects; every reader normalises |
| P-20 | `offer_source` must not claim a creator when none attached | **FAIL — real finding, see below** |

### P-20 — the one failure

All **6 of 6** sales in production are labelled `offer_source = 'influencer'` while having
no creator attached at all. Cause: the column carries a **default of `'influencer'`**, so
any direct sale that never sets it is recorded as creator-driven.

- **Money is not affected.** Commission is correctly ₹0 — no creator was involved.
- **Reporting is.** "Sales through creators" is the headline metric of a creator-commerce
  platform, and it currently counts every direct sale. Today that reads 6 of 6 when the
  true figure is 0 of 6.

Filed as its own task. Not fixed here, because this plan is for testing, not changing code.

### Two things L1 surfaced that are not failures but matter

1. **Only one brand accepts proposals, and no brand has a city recorded.** The Part 6 city
   filter will therefore show nothing at all in production, and the industry filter will
   offer exactly one option. The feature is correct; the data is empty. Worth knowing before
   you judge it on a phone.
2. **19 live collaborations all use scope `products`.** Nothing in production uses
   whole-store or category allocation, so Part 4's auto-join behaviour — new products
   joining a creator's shelf automatically — **has never happened in production.** L2 must
   cover it.

---

## 4. L2 — End to end on a local database (blocked on Docker)

`pnpm qa:e2e:conversion` already exists: it seeds users through the **real API** against a
local Postgres in Docker, mints a token, and drives Playwright. Two specs use it today. It
is the right vehicle for everything below, and none of it touches production or real money.

I will extend it to these cases. Each is written as a result to be produced, not code.

### Part 1 — corrections

| # | Case | Expected |
|---|---|---|
| E1-1 | Attach an offer to an unpublished product, via the campaign wizard path | Refused |
| E1-2 | Same, via the offer-engine path | Refused |
| E1-3 | Publish the product, retry | Accepted |
| E1-4 | Unpublish a product inside a live offer | Warns, proceeds (founder's decision) |
| E1-5 | A conversion collab with commission and no discount — what the shopper sees | Commission **never** rendered as a discount |
| E1-6 | Read an offer written by an old mobile build (legacy type) | Inferred to a canonical type, not rejected |

### Part 4 — allocation and offers

| # | Case | Expected |
|---|---|---|
| E4-1 | Allocate whole store; add a new product afterwards | **Auto-joins** the creator's shelf — never yet seen in production |
| E4-2 | Allocate a category; add a product in and out of it | Only the in-category one joins |
| E4-3 | Allocate 3 specific products; add a new one | Does **not** join |
| E4-4 | **Full-price commission-only sale, end to end** | Sale completes, commission accrues, no discount anywhere |
| E4-5 | Storewide 20% + creator 15% on one basket | Exactly **one** offer applies — the better one |
| E4-6 | Same, where the creator's offer is worse | Customer is **not** worse off for using a creator link |
| E4-7 | Cart-shaped offer (volume / BOGO) mixed with a simple discount | One winner, cart integrity kept |
| E4-8 | Offer expires overnight | Stops applying **and** stops advertising |

### Dead offer join

| # | Case | Expected |
|---|---|---|
| ED-1 | Non-follower browses a creator with a live collaboration | Creator and products **visible** |
| ED-2 | Deal counts for that creator | Non-zero |

### Part 2 — the handshake

| # | Case | Expected |
|---|---|---|
| E2-1 | Brand requests a creator, no campaign exists | Request delivered |
| E2-2 | Creator counters money and time | Brand sees old → new |
| E2-3 | Creator counters a **requirement** | Refused — requirements are not counterable |
| E2-4 | Both sides exhaust their 2 counters | Third is refused |
| E2-5 | Creator accepts | **Agreement** created; no campaign, no contract |
| E2-6 | Brand briefs the agreement into a campaign | Terms pre-filled from the agreement |
| E2-7 | Brand edits an agreed term while briefing | Warned per field, never silent |
| E2-8 | Creator accepts the campaign | **One click**, contract generated, negotiate refused |
| E2-9 | Consume the same agreement twice | Second attempt fails loudly |
| E2-10 | Creator declines, brand retries immediately | Blocked by cooldown |
| E2-11 | Creator mutes brand requests | Brand told they cannot send |
| E2-12 | Creator sets a minimum below the brand's offer | Request refused with the reason |
| E2-13 | Creator's pitch accepted by a brand | Agreement — **no fabricated stub campaign** |

### Part 5 — the sales aim

| # | Case | Expected |
|---|---|---|
| E5-1 | Create a campaign with no budget and no end date | Succeeds |
| E5-2 | All-sales campaign, publish | Succeeds, `end_date` stays NULL |
| E5-3 | All-paid campaign, sets total ₹60,000 across creators | `total_budget` = 60000, derived |
| E5-4 | All-paid, last posting window 25 Oct | `end_date` = 25 Oct, derived |
| E5-5 | **Mixed** campaign (sales + paid) | `end_date` NULL — sales wins |
| E5-6 | Add a sales set to a dated all-paid campaign | `end_date` **cleared** |
| E5-7 | **The trap:** all-sales campaign one day after its post-by date | Products **still selling** |
| E5-8 | End an active campaign | `completed`, never `cancelled` |
| E5-9 | End with an unreleased tranche | Refused, names it, row unchanged |
| E5-10 | End with a deliverable awaiting review | Refused, row unchanged |
| E5-11 | End a draft, and an already-ended campaign | Refused, status named |
| E5-12 | After ending: discovery, and the creator's link | Products gone, link stops selling, creators notified |
| E5-13 | Tranche 3 on an undated campaign | Still releases on its own clock |
| E5-14 | Cron on an undated campaign | Never auto-completes it |

### Part 6 — the creator side

| # | Case | Expected |
|---|---|---|
| E6-1 | Creator opens an agreement-backed collaboration | Settled terms shown as settled, with the agreed date |
| E6-2 | Same screen | **No negotiate option** |
| E6-3 | Creator opens a **cold** invite | One list, negotiate present, no "already agreed" box |
| E6-4 | Whole-store allocation | Reads "Their whole store"; new arrivals appear |
| E6-5 | Fixed-list allocation | Reads "N selected products"; new arrivals do **not** appear |
| E6-6 | Filter brands by industry, then city, then both, then clear | Narrows correctly, composes with name search |
| E6-7 | Try to apply to an open campaign | **No route exists** — deferral intact |

---

## 5. L3 — Brand web walkthrough

Real browser, real login. I can drive this if you sign in, or you can and I verify the rows
underneath as you go.

| # | Case | Expected |
|---|---|---|
| W-1 | Campaign creation, step 1 | **No budget field, no end-date field** |
| W-2 | Build an all-sales campaign to review | Reads "1 Sep 2026 → Ongoing", no budget row, no wallet card |
| W-3 | Build an all-paid campaign | Total appears as computed text, nowhere editable |
| W-4 | Campaign list, detail, dashboard tile | "Ongoing", never a bare dash |
| W-5 | End campaign | Warning states products leave the shopping app; confirm works |
| W-6 | End on a draft | Action absent |
| W-7 | Influencers tab | Five sub-tabs; row action is "Request collab" |
| W-8 | Request composer | Money and time per aim; requirement/preference pickers; **no deliverables field** |
| W-9 | A creator's counter | Old → new diff, accept and decline both work |
| W-10 | Ready to brief → "Brief into a campaign" | Wizard opens pre-filled |
| W-11 | Edit an agreed term in the wizard | Warning names the field |
| W-12 | Allocation control | Category **tree** expands; product search shows image, title, price |

---

## 6. L4 — Mobile on device · FOUNDER ONLY · five releases owed

Six Maestro flows exist (`qa/maestro/flows/`) and have never run for Parts 1–6. Start with
`pnpm qa:maestro:doctor`, then `pnpm qa:maestro`. Then these by hand:

### Brand app
| # | Case | Expected |
|---|---|---|
| M-1 | Creator profile | **"Request Collaboration"** above "Invite to Campaign" |
| M-2 | Send a request | Money and time per aim, importance markers, no deliverables |
| M-3 | Collab requests screen | Counter shows old → new; accept, decline, withdraw all work |
| M-4 | Ready to brief | States the campaign is built on the web — no dead tap |
| M-5 | Campaign detail, open-ended campaign | "Ongoing", and **End campaign** with its warning |
| M-6 | Notification taps | Land on the right screen, never nowhere |

### Creator app
| # | Case | Expected |
|---|---|---|
| M-7 | Proposals hub | Three tabs: Discover, My Pitches, **Requests** |
| M-8 | Open a brand request | Requirement locked and absent from the counter; preference framed as a question |
| M-9 | Counter money and time | Sends; brand sees exactly what moved |
| M-10 | Accept | Explains the campaign comes next |
| M-11 | Preferences | Mute, broadcast opt-out, minimums, aims — all persist |
| M-12 | An agreement-backed collaboration | Settled/new split, agreed date, no negotiate |
| M-13 | A cold invite | Unchanged, negotiate present |
| M-14 | "You can sell" line | Matches the products screen |
| M-15 | Brand discovery filters | Industry filter works (**expect only 1 option; city will be empty — see P-14**) |

---

## 7. L5 — The money path · highest business risk

Not one commission-bearing sale has ever occurred. Until one does, the platform's core
promise is untested. Run on a real device with a real ₹1–₹100 product; I verify each row.

| # | Case | Expected |
|---|---|---|
| $-1 | Shopper opens a creator's link | Creator's products visible |
| $-2 | Buy at **full price** (no discount) | Order completes |
| $-3 | The sale row | All four attribution ids present; `offer_source` correct (**see P-20**) |
| $-4 | Creator's earnings screen | Commission appears in pending |
| $-5 | Brand's conversions screen | Same sale, same number |
| $-6 | After the 30-day window | Pending becomes withdrawable |
| $-7 | Buy **with** a discount | One offer applied, correct arithmetic, commission on the right base |

---

## 8. L6 — Known defects: confirm, don't ship

Run in L2 only. Never on production money.

| # | Defect | Expected today |
|---|---|---|
| D-1 | Cancel a **funded** campaign | Crashes, refunds nothing — writes an escrow status the database rejects |
| D-2 | `offer_source` on a direct sale | Labelled `influencer` (**P-20**) |
| D-3 | Open-group joiner | No allocation, no commission — cannot sell |
| D-4 | Publishing an open group | Notifies every creator with "Apply now!", links to a screen that does not exist |
| D-5 | Seven live campaigns | Still hold invented end dates until a set is edited |

---

## 9. Recommended order

1. **Start Docker Desktop.** Then I build and run L2 — the biggest single conversion of
   guesswork into evidence, with no effort from you.
2. **L3 with me driving**, or you driving while I watch the database.
3. **L4 on your phone** — the five-release backlog.
4. **L5 last**, once L2 has proven the money logic on a local database.

L1 is done. L6 rides along with L2.
