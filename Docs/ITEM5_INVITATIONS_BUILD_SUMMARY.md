# Item 5 — Choosing creators, terms and invitations: build summary

Built 12 September 2026 from the approved gap report (`Docs/ITEM5_INVITATIONS_GAP_REPORT.md`), the
approval message, rules v1.16 §7A and the locked mockups I1–I15. Contract
`features/item5-invitations/`. **Nothing has been deployed:** migration 181 has only been dry-run
against production; no push, no OTA. This is production-impacting and waits for an explicit go.

## 1. Migration 181 and the backfill

Additive: two enum values (`withdrawn`, `removed`), eleven nullable columns on `campaign_influencers`
(sent at / by / from where, the note, usage rights, answered at, withdrawn and removed at / by), two
CHECKs, the partial unique index on live rows, one index for the set screen.

| Production dry run (`node scripts/run-181.js --dry`) | |
|---|---|
| Invitation rows | 8 |
| Rows that came through a briefed agreement → `source = 'pitch'` | 8 |
| Rows with no agreement → `source = 'legacy'` | 0 |
| Live duplicates that would break the unique index | 0 |
| Enum values / columns / indexes already present | none |

After apply every row will carry `invited_at = created_at`; the runner verifies the counts and exits
non-zero if anything is missing. The test database applies the same file on every run.

## 2. One send service, and every door that goes through it

`backend/src/services/invitationSend.service.js` is now the only place that writes an invitation row
(`prepareOne` runs the fourteen gates read-only, `insertOne` writes). The doors:

| Door | Route | Mode |
|---|---|---|
| The item 5 send (I8) | `POST /campaigns/:id/sets/:sid/invitations` | strict: every §7 rule per Aim |
| The legacy brief of an agreed pitch, and the fifteen legacy suites | `POST /campaigns/:id/sets/:sid/invite` | legacy: whatever is present is held to the rules (a commission of 140 is refused); a missing commission, fee or deliverables list is **not** demanded (see §8) |
| The brand's cancel (website "Cancel assignment") | `POST /campaigns/:id/influencers/:ciid/cancel` | now the **remove**; it used to write `'cancelled'`, a status the database rejects |
| Withdraw / remove (I10) | `POST …/invitations/:ciId/withdraw`, `…/remove` | invited only / any pre-signed status |
| Edit sent terms | `PATCH …/influencers/:ciId` | refuses every row: "Terms can't be changed once the invitation is sent. Withdraw it and invite again." |

The shared input helpers (allocation, offer, promoted offers, formats, channels, coupon) moved out
of the controller unchanged into `invitationInputs.service.js`; the terms rules live in
`invitationTerms.service.js`; accept and decline in `invitationAnswer.service.js`, used by both the
legacy `/offers` door and the new creator endpoints. The set summary now carries the creators grouped
in the I9 order (50 per group with the real count).

## 3. The open-group broadcast

**Unreachable, left alone.** No live screen can create an open-group set: neither the phone's set
editor nor the website's sends `influencer_mode`, so every set is `handpick`; production has nine
sets, all `handpick`. The broadcast inside publish therefore has nothing to broadcast to. Nothing was
switched off and nothing was rebuilt.

## 4. The two offer fixes

- **Gap A — the sale records which offer produced it.** The tracking query now selects the
  creator's `brand_offer_id` and the sale writes the resolver's winning offer id (a library id for a
  snapshotted or published offer; null for a bespoke special offer, which has no library row).
- **Gap B — an offer never applies before its start date.** `creatorOfferNotYetLive` in the
  resolver; the storefront no longer advertises a not-yet-live offer either.

Proof is at the unit level (`tests/item5-invitations.test.js › offer fixes`): the tracking record
carries the id and start date, the resolver refuses a future-dated offer and applies a live one, and
the winner's id equals the library row. **No real sale was placed**, on the test database or in
production; the founder asked for a sale as proof and this stops one step short, at the record the
sale writes from.

## 5. Item 7 handover — the five terms a contract cannot carry today

A contract copies **only the fee and the posting date** from the invitation row
(`contract.service.js` autoCreate). Item 5 stores the rest on the row so item 7 only has to read it:

| Term | Column on `campaign_influencers` |
|---|---|
| Deliverables (type + count rows) | `formats_json` |
| Usage rights | `usage_rights_json` `{ on, duration_days | null, places[] }` |
| Selling scope | `alloc_scope`, `alloc_category_node_id`, `alloc_category`, `alloc_product_ids` |
| The brand's note | `brand_note` |
| The follower offer snapshot | `offer_type`, `offer_config_json`, `brand_offer_id`, `offer_valid_from`, `offer_valid_until` |

Plainly: an agreement generated today would carry none of them.

## 6. Test results

Baseline before item 5: **229 failed / 914 passed / 1143**.

| Suite | Result |
|---|---|
| Backend, full run after item 5 (13 Sep, one clean run) | **229 failed / 940 passed / 1169** (47 failed suites of 112) — **0 new failures**, 0 fixed, 28 new tests all passing (`compare.js` against the item 4 baseline) |
| Backend `tests/item5-invitations.test.js` | 26 / 26 |
| Mobile, whole suite | 459 / 459 (17 new: 10 brand, 7 creator) |

The two names `compare.js` reports as "gone" are the two legacy tests renamed because their behaviour
changed by decision (PATCH refused; the update path cannot clear an offer window); their replacements
are among the 28 new. The 229 pre-existing failures are the same 229 as before item 5.

Legacy assertions changed, each because the approved behaviour changed or the code moved, never to
hide a failure: `offer-attach` test 8 (PATCH is now refused), `item2-eligibility` test 5 (the result
gained `minimums`), `brief-to-signing`, `offers-parity-backend` and `coupon-not-mandatory` (they read
controller source text; the same code now lives in the services), mobile `item4Brand` (Add creators
opens the picker) and `item3Creator` (the pitch card sits on Pitches).

## 7. Checks 1–42

| # | Check | Result | Where |
|---|---|---|---|
| 1 | Add creators opens the Discover list with checkboxes | ✅ | B I1; B I9 |
| 2 | Ineligible → "Can't invite", not selectable, no reason | ✅ | backend picking; B I1 |
| 3 | Live in the set → "Invited", locked | ✅ | same |
| 4 | Declined / expired / withdrawn can be picked again | ✅ | backend picking, withdraw |
| 5 | Group "{k} of {n}" with the three labels | ✅ | backend group check |
| 6 | Pay for Sale saves; empty categories refused with the exact message | ✅ | backend validator, send; B I3 |
| 7 | Content refuses empty / duplicate / out-of-range deliverables | ✅ | backend validator; B I4 |
| 8 | Hybrid refuses ₹0 | ✅ | backend validator; B I5 |
| 9 | Usage rights with no place refused | ✅ | backend validator; B I4 |
| 10 | Below minimum warns on terms and Review, still sends | ✅ | backend eligibility; B I3, I8 |
| 11 | Copy to everyone: money yes, special offer never | ✅ | B I4, I5 |
| 12 | Saved offer attaches; preview shows price and earnings | ✅ | backend send; B I5 |
| 13 | Editing the library later changes nothing sent | ✅ | backend send |
| 14 | Three special kinds; scope hidden for BOGO; save to library | ✅ built; save-to-library and the amount message proven on the server | backend send; sheet |
| 15 | Future start date not applied | ✅ | backend Gap B |
| 16 | Sale records the offer | ✅ at the record level; no sale placed | backend Gap A |
| 17 | Send n → n rows, n notifications, set live | ✅ | backend send; B I8 |
| 18 | Locks Aim / date / mode / branch | ✅ | backend send |
| 19 | After the cutoff refused; Add creators hidden | ✅ | backend set-level; B |
| 20 | Became ineligible → named, nothing written | ✅ | backend send |
| 21 | Groups correct; counts line item 4's | ✅ | backend set; B I9 |
| 22 | Withdraw before an answer only; no reason; re-invite | ✅ | backend withdraw; B I10 |
| 23 | Remove until both signatures; no contract destroyed | ✅ | backend remove |
| 24 | Edit sent terms refused with the exact message | ✅ | backend |
| 25 | Invites card fields | ✅ | backend creator; C I11 |
| 26 | Set block then personal block; no address | ✅ | backend creator; C I12 |
| 27 | Deliverables in words; 25/25/50 in rupees | ✅ | backend creator; C I13 |
| 28 | Accept → accepted both sides, brand notified | ✅ | backend creator; C |
| 29 | Decline: reason required, text kept, brand sees both | ✅ | backend creator; C |
| 30 | After the cutoff actions gone; API refuses | ✅ | backend creator; C |
| 31 | Counter → placeholder, writes nothing | ✅ | backend creator; C |
| 32 | 404 for another brand / creator | ✅ | backend |
| 33 | No creator response leaks | ✅ | backend (LEAK regex) |
| 34 | Loading / empty / couldn't-load with Try again | ✅ | C; B via DiscoverList |
| 35 | No new backend failures | ✅ | full run + compare |
| 36 | Deferred: own heading, not waiting, survives the cutoff | ✅ | backend set |
| 37 | Accept / Counter / Decline only; Counter hidden when off | ✅ | C; backend |
| 38 | Failed batch names creators, writes nothing, remove-and-send | ✅ | backend send; B I8 |
| 39 | Legacy row refuses a terms edit (invited_at backfilled) | ✅ | backend |
| 40 | Open-group broadcast: unreachable, stated | ✅ | §3 |
| 41 | Above 50% asks once; server accepts | ✅ | B; backend validator |
| 42 | Legacy creator inbox / detail no longer leak | ✅ | backend |

No check was run on a phone; per the prompt, end-to-end testing waits for item 7.

## 8. Left open

1. **The legacy brief door does not demand the full terms (founder Q6).** `POST …/invite` validates
   what is present but does not refuse a missing commission, fee or deliverables list, because the
   brief has no screen that could supply them and fifteen legacy suites invite without them. You asked
   to be told before the brief is made to fail. Decision needed: make the brief door strict (those
   suites become fixture drift to update), or leave it lenient until item 8 rebuilds the brief.
2. **"Some categories" picks one category.** The row stores a single category node
   (`alloc_category_node_id`), read in eight places. Several categories per creator needs a new
   column and those readers. The mockup's two tags were built as one pick.
3. **The minimum hint does not name the category** ("Priya's minimum is 12%."), because the
   server's `minimums` does not carry the sub-category it matched.
4. **The "Another set" chip is informational.** Putting a deferred creator into another set stays
   with item 4's moved-out list, which has no screen yet.
5. **The website's "Cancel assignment" toast** still prints "Refund: ₹0.00"; the route now removes,
   and no money moves. Wording only.
6. **Cross-set:** a creator live in another set of the same campaign is still refused (item 4's
   rule, kept); the mockups' rules table says a creator can be in more than one set. Not changed.
7. **Item 6** picks up `canCounter` and the placeholder; **item 7** picks up the five columns in §5;
   the Active tab is empty until then.

## 9. Deploy, on the go

```bash
cd backend && node scripts/run-181.js --apply
```
then commit and push (Render + Vercel), then from the repo root, one at a time:
```bash
pnpm publish-ota:brand
```
```bash
pnpm publish-ota:influencer
```
