# Creator collab conversations — invitations in, pitches out, under Collabs

**Trigger:** founder, 2026-08-15. A collaboration request was sent to Sagar Joshi from
brand-web and the creator could not find it. Diagnosis below. Then: *"under collab tab,
make invitations from brands and its flow… next requests made by influencer to brands and
its flow… like next steps like acceptance or reject or negotiate things."*

**Program:** follows `features/collab-part2-precampaign-handshake` (which built the
handshake) and `features/collab-part6-creator-side` (which built the settled-vs-new split).
This contract is about **where those conversations live and how a creator finishes them.**

---

## 0. What the audit found (verified 2026-08-15, prod + code)

### 0.1 The request was never lost — it was never reachable

Production, at the time of writing:

| | |
|---|---|
| `brand_collab_requests` | 2 rows, both `status = 'sent'` |
| the founder's row | influencer `070418e5…` = **Sagar Joshi** (`sagartravel`) ✓ · 15% commission · post by 2026-08-24 · scope "bottom wear" |
| notification | `collab_request.received` created for Sagar's user, **unread** |
| **`viewed_at`** | **NULL on both rows** |

`listCreatorRequests` flips `sent → viewed` on the first read
(`handshake.controller.js:347`). It is still NULL on *both* requests, so that endpoint has
**never been called** on that account. The screen was not opened-and-empty. It was never
opened.

Because the only way in is:

> Profile tab → "Brand Outreach" card → **"Brand Proposals"** → third tab **REQUESTS**

`InfluencerNavigator.js:67` registers `ProposalsHub` in the **Profile** stack. The single
tap-through is `ProfileScreen.js:513`, whose subtitle still reads **"DISCOVER + TRACK
PITCHES"** — written before brands could ask anybody. Nothing on it says a brand can ask
*you*. The hub opens on DISCOVER; REQUESTS is third. There is no unread badge anywhere.

Part 2 shipped the creator inbox as a tab inside a screen that predates it, while the IA
redesign moved collaborations to their own **Collabs** tab. A brand's opening move is
filed under Profile documents; every other brand interaction lives in Collabs. It is in
the wrong room.

### 0.2 The two directions are not symmetric, and the outgoing one is a dead end

| | brand → creator (`brand_collab_requests`) | creator → brand (`influencer_proposals`) |
|---|---|---|
| accept | ✔ | ✔ (brand accepts) |
| decline | ✔ both sides | ✔ both sides |
| **counter** | ✔ **both sides, 2 rounds each**, tracked in `brand_rounds_used` / `creator_rounds_used` / `counter_by` | ✖ **brand only.** The creator's sole reply is `respond-counter` with `action ∈ {accept, decline}` (`proposal.controller.js:195-198`) |
| round limit | ✔ `handshake_settings.counter_rounds_per_side` | ✖ **none — a brand may counter forever** |
| detail screen | ✔ `CollabRequestDetailScreen` | ✖ inline cards only; `getMyProposal` exists on the server and **mobile never calls it** |

So a creator who pitches ₹20,000 and is countered at ₹8,000 can accept ₹8,000 or walk
away. They cannot say ₹14,000. "Negotiate" today means negotiate only when the brand
started the conversation.

`listMyAgreements` (`api.js:395`) is likewise **never called by mobile** — an accepted
pitch produces an agreement the creator is never shown.

### 0.3 A brand can accept terms nobody offered

`acceptProposal` calls `acceptedFlow(proposal, useCounterTerms = false)`
(`proposal.controller.js:295`) — brand acceptance always settles the creator's **original**
terms. That is correct today only because the creator can never counter. The moment 0.2 is
fixed, a brand pressing Accept after the creator moved to ₹14,000 would silently agree
₹20,000. This is a latent bug that this contract's own change would arm, and it is fixed
here rather than shipped.

### 0.4 Threading is already possible in the schema — and used nowhere

```
brand_collab_requests.id  ─┐
                           ├─→ collab_agreements.source_request_id  / .source_proposal_id
influencer_proposals.id   ─┘         │
                                     └─→ campaign_influencers.agreement_id (+ consumed_ci_id)
```

Every link exists (migration 149). No endpoint and no screen walks it. A creator who
agreed terms with a brand and then receives that brand's campaign sees two unrelated
things in two unrelated places.

---

## 1. What this builds

Founder decisions, 2026-08-15:

- **One thread per brand.** A request → the agreement it produced → the campaign that was
  briefed from it is **one row**, telling one story. Not three rows in three lists.
- **Symmetric negotiation.** The creator can counter the brand's counter on their own
  pitch, under the same round limits as the handshake.

### 1.1 Collabs gains two front stages

`COLLAB_STAGES` today is `invites · applied · negotiating · to_sign · active · tracking ·
completed · archive`. Two stages join the **front**:

| stage | label | what is in it |
|---|---|---|
| `invitations` | **Invitations** | brand-initiated and not yet a signed campaign: handshake requests, agreements waiting to be briefed, and campaign invites — cold or agreement-backed |
| `pitches` | **My pitches** | creator-initiated and not yet a signed campaign: proposals in flight, plus agreements from accepted pitches |

A thread sits at **exactly one stage — its current one**, the same rule `deriveStage`
already follows. Once a thread's campaign is accepted it leaves Invitations and flows on
into `to_sign` / `active` / `tracking` as it does today. Nothing already in the pipeline
changes stage.

The existing `invites` stage is **absorbed into `invitations`** rather than left beside it.
Two tabs both meaning "a brand wants me" is the confusion this contract exists to remove.

### 1.2 The thread

One thread = one `(brand_id, influencer_id)` conversation chain. Built server-side, in a
new endpoint, so the two apps cannot drift and the test can assert the payload:

```
GET /v1/influencers/me/collab-threads
```

Each thread carries: the brand, `direction` (`inbound` | `outbound`), the current
`state`, `turn` (`you` | `brand` | `nobody`), the **latest terms** and who last moved them,
`rounds_left`, and an ordered `timeline[]` of everything that happened — request sent,
countered by you, countered by them, agreed, campaign briefed.

Dedupe rule: if `collab_agreements.source_request_id` (or `source_proposal_id`) points at a
record, and `campaign_influencers.agreement_id` points at that agreement, all three are
**one thread**. A cold campaign invite with no `agreement_id` is a thread of one.

### 1.3 The flows — every next step, spelled out

**Invitation from a brand** (`brand_collab_requests`)

| state | whose turn | what the creator can do |
|---|---|---|
| `sent` · `viewed` | you | **Accept terms** · **Counter** · **Not interested** |
| `countered` by you | brand | nothing — "waiting on {brand}", rounds left shown |
| `countered` by them | you | **Accept** · **Counter again** (if `rounds_left > 0`) · **Not interested** |
| `agreed` → agreement `ready` | brand | nothing — "{brand} is building the campaign", agreement expiry date shown |
| agreement `consumed`, campaign invite live | you | **Review campaign** → the Part 6 settled-vs-new screen, one-tap accept, no Negotiate |
| `declined` · `expired` · `withdrawn` | — | archive, with the reason |

**Pitch to a brand** (`influencer_proposals`)

| state | whose turn | what the creator can do |
|---|---|---|
| `sent` · `viewed` | brand | **Withdraw** |
| `countered` by them | you | **Accept counter** · **Counter back** ← NEW · **Decline** |
| `countered` by you | brand | nothing — "waiting on {brand}", rounds left shown |
| `accepted` → agreement `ready` | brand | nothing — "{brand} is building the campaign" |
| agreement `consumed`, campaign invite live | you | **Review campaign**, as above |
| `rejected` · `expired` · `withdrawn` | — | archive, with the brand's reason where given |

A **requirement** stays locked and absent from the counter composer, exactly as Part 2
established: a counter that quietly rewrites a requirement looks like agreement and is not.

### 1.4 Backend — making the pitch negotiable

**Migration 152**, additive, mirroring what `brand_collab_requests` already has:

```sql
ALTER TABLE influencer_proposals
  ADD COLUMN brand_rounds_used   integer NOT NULL DEFAULT 0,
  ADD COLUMN creator_rounds_used integer NOT NULL DEFAULT 0,
  ADD COLUMN counter_by          text;          -- 'brand' | 'creator'
```

Backfill: existing rows with `counter_terms IS NOT NULL` get `counter_by = 'brand'`,
`brand_rounds_used = 1` — today only a brand can have countered, so this is a statement of
fact, not a guess. `counter_terms` keeps its column name and becomes "the latest counter,
whoever sent it", matching `counter_terms_json` on the request table.

**New route** — `POST /v1/influencers/me/proposals/:id/counter`, mirroring
`/collab-requests/:id/counter`: validates through the **same** `collabTerms.model` the
handshake uses, refuses a counter that touches a requirement, refuses when
`creator_rounds_used >= handshake_settings.counter_rounds_per_side`, notifies the brand.

**Three corrections to existing behaviour**, each a real defect once countering is
two-way:

1. `acceptProposal` settles the **latest** terms, whoever last moved them — not always the
   creator's original (§0.3).
2. `counterProposal` (brand) is bounded by `counter_rounds_per_side`. It is unbounded
   today.
3. `respondToCounter` refuses when the creator is not the one being countered — today it
   only checks `status = 'countered'`, which after this change is also true when the
   *creator* countered.

**Brand side must be able to answer.** A creator countering into a void is worse than no
counter at all. The brand's existing proposal inbox — `dashboard/proposals/page.js` (web)
and `BrandProposalInboxScreen.js` (mobile) — shows the creator's counter as an old→new
diff and offers Accept · Counter · Reject. Same diff component pattern as the handshake
composer.

### 1.5 Where the old surface goes

`ProposalsHub`'s REQUESTS and MY PITCHES tabs are **retired** — their content now lives in
Collabs. DISCOVER (browse brands, send a pitch) stays where it is: it is a directory, not a
conversation. The Profile row is relabelled to what it now does, **"Find brands to pitch"**,
so it stops promising an inbox it no longer holds.

`CollabPreferences` (mute, minimums, aims) moves with the inbox — reachable from the
Invitations stage header, where a creator is actually thinking about who may ask them.

Notification deep links repoint from `Profile → ProposalsHub` to the thread in Collabs.
`CollabRequestDetailScreen` is not deleted; it is restyled to `ig` and becomes the inbound
half of the thread detail.

### 1.6 Finding brands — the directory is empty and the filter reads the wrong column

Founder, 2026-08-15: *"when influencer try to search brands should be clear and with neat
filters like area and industry (anyway current focus is only fashion)."*

Two things have to be said before designing chips.

**The pool is one restaurant.** Prod holds **26 brands**; exactly **one** has
`accepts_proposals = TRUE` — *Aveen food paradise*, category `restaurant`, with `city` and
`locality` both NULL. **Zero fashion brands are pitchable.** The industry facet would offer
one value; the area facet would offer none. A creator opening "Find brands to pitch" today
sees a single restaurant with no location.

This is not a bug — `accepts_proposals` defaults false, and Part 2 recorded the asymmetry
deliberately: creators are reachable by default and can mute, **brands opt in**. The
consequence is that the creator's outbound route has been shipped and unusable since it was
built. Three ways out, and it is the founder's call:

| option | effect |
|---|---|
| **A — default on for approved brands** (recommended) | One migration flipping `accepts_proposals` to true for `status='approved'` brands, with the existing per-brand toggle unchanged. Mirrors the creator side, which is reachable-by-default for exactly this reason. |
| **B — surface the toggle to brands** | Add it to brand onboarding and settings so brands opt in knowingly. Honest, slower, and depends on brands acting. |
| **C — leave it** | Discovery ships correct and empty. Filters would be tested against one restaurant. |

**The area data is on a table discovery never reads.** `discoverEligibleBrands` filters on
`users.city` (`proposal.service.js:217-243`) — the *only* geo field it touches. Meanwhile
`brands` carries, unused:

| field | populated | example values |
|---|---|---|
| `brands.locality` | 12 / 26 | HITEC City, Jubilee Hills, Indiranagar, Bandra, Gachibowli |
| `brands.pincode` | 11 / 26 | — |
| `brands.lat` / `lng` | 13 / 26 | — |
| `brands.formatted_address` | 7 / 26 | — |
| `users.city` | 16 / 26 | **the one it uses** |

And `users.city` is dirty free text: **"Vijayawada" (5)** and **"Vijaywada" (1)** are two
facet entries for one city; **"Tadepalle"** is a locality filed as a city. Chips generated
off this column show the same place twice and ask the creator to choose.

So:

- **Area** filters `brands.locality`, scoped to a city, with "Change city" to move. Falls
  back to city level for a brand with no locality.
- **Industry** filters `brands.category`, from server-derived facets as Part 6 established,
  and is **hidden entirely when only one industry has brands** — a filter with one option is
  a label pretending to be a control. With the fashion-only focus this row will usually not
  render, which is correct.
- **City normalisation** is a data fix, not a UI one: a canonical city per brand derived
  from `formatted_address` / `pincode` where present. A backfill plus manual review of the
  handful that resolve to nothing — sized honestly, not as a one-liner.

**Eligibility moves onto the row.** `checkEligibility` already exists and already returns a
reason string — and runs **on submit**. A creator picks a brand, writes a title, a message,
terms, deliverables and three portfolio links, presses Send, and is told "this brand only
accepts proposals from macro tier and above." Running the same check per row and shipping
`{ eligible, reason }` in the discovery payload turns twenty wasted minutes into a greyed
line. Ineligible brands are **greyed with the reason, not hidden** — hiding them reads as
"no brands exist".

### 1.7 Writing a pitch — four steps, and one shared vocabulary

Today `SendProposalScreen` is a single 317-line scroll: title, message, goal chips, fee,
commission, five deliverable counters, two dates, three link fields, and a criteria card
the creator is expected to self-assess against.

It becomes a **four-step wizard**, matching the stepper pattern the listing add flow
already uses:

1. **The deal** — aim, and what you'd promote
2. **Money and time** — the ask, each term marked *Must have* or *Flexible*
3. **What you'd deliver** — deliverable counters, then title and message
4. **Review** — the pitch as the brand will see it, plus a resolved eligibility verdict

Three substantive changes, not just layout:

**One vocabulary.** The pitch form calls the aim `goal` and labels it **"ENGAGEMENT (FEE)"
/ "CONVERSION (COMM)"**. The invitation thread labels the *identical* enum **"Pay for
content" / "Pay per sale"**. One creator, two directions, two vocabularies for the same
three values — the exact duplicated-vocabulary fault Part 2 caught twice. The pitch adopts
the invitation's words.

**Importance markers.** A pitch carries none today. Without them "must have" has no meaning
on a pitch and the brand's counter has no rules to respect — so the symmetric negotiation in
§1.4 has nothing to enforce. Every term gets a requirement/preference marker, and the pitch
validates through **`collabTerms.model`**, the same module the handshake uses.

**Message after terms.** A creator writes a better pitch message once they know what they
are asking for.

Kept as-is: the deliverable counters, and the three portfolio URL fields. *Flagged, not
built:* creators now have real Posts in the Create tab, and picking two of their own posts
beats pasting URLs. Its own slice.

### 1.8 Not in this contract

- **Unread badge on the tab bar icon.** Wanted, but the tab bar has no badge mechanism
  today and adding one touches all four apps. Its own slice.
- **Brand-web creator-facing anything.** There is no creator web surface; Part 6 already
  recorded that mistake being made and removed.
- **Open-campaign application.** Still deferred, per Part 6 §6.3, and for the same
  reasons.

---

## 2. Palette note, stated because it is easy to get wrong

`CollabsListScreen` renders in `theme/ig` (the white/black restyle). Every screen moving
into Collabs — `ProposalsHubScreen`, `CollabRequestDetailScreen`, `CollabPreferencesScreen`
— renders in `theme/tokens` `brandPalette` (yellow). Moving them without restyling would
put a yellow screen one tap inside a white-and-black tab. All moved screens are restyled to
`ig`.

---

## 3. Slices

| # | slice | targets |
|---|---|---|
| 1 | Migration 152 + `collabTerms` validation for the pitch + the three corrections in §1.4 | backend |
| 2 | `GET /collab-threads` — the threaded read, both directions, with timeline | backend |
| 3 | Creator counter route + notification | backend |
| 4 | Collabs list: two front stages, threaded rows, turn/rounds; `ProposalsHub` retired to DISCOVER only | Mobile (influencer) |
| 5 | Thread detail: timeline + every action in §1.3, `ig` restyle of the moved screens | Mobile (influencer) |
| 6 | Brand answers a creator counter — diff + Accept/Counter/Reject | brand-web, Mobile (brand) |
| 7 | Discovery: area filter on `brands.locality`, industry facet that hides at one option, per-row eligibility + reason | backend, Mobile (influencer) |
| 8 | Pitch composer: four-step wizard, shared aim vocabulary, importance markers, `collabTerms.model` validation | Mobile (influencer), backend validation |
| 9 | City normalisation backfill + the `accepts_proposals` decision from §1.6 | backend, migration |

Slices 1–3 are safe for un-updated app builds: additive columns, one new route, and
corrections that only change behaviour in states no client can currently produce.

Slice 9 carries a **founder decision** (§1.6 options A/B/C) and does not start until that
is made. Slices 7 and 8 are correct and shippable whichever way it goes — they just have
almost nothing to list until it is settled.
