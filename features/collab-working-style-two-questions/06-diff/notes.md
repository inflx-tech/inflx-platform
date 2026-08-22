# Before / after

## What the mockup promised, and what was built

| Board | Promised | Built |
|---|---|---|
| 1 | Request screen: two chips, then a conditional shipping question | Yes. `WHERE THEY'D WORK` → Not stated · Store visit · Remote, with the shipping block indented under Remote only. |
| 2 | Creator reads two lines instead of one phrase | Yes — `Where you'd work` and `Products`. |
| 3 | No new shipping flow; the existing one is entered on purpose | Yes. Nothing in `production_events`, the reminder job, the PDF or the admin alert was touched. |
| 4 | Contract screen asks the same two questions, pre-answered | Yes, plus the field that makes pre-answering possible. |
| 5 | Backend unchanged | **No — this is the one departure. See below.** |

## Departure from the impact note

The impact note said `backend/src` was unchanged. It is not.

Pre-filling the contract screen "from what you both agreed" needs the agreed working style
to actually reach the client, and it did not — the contract detail response had no path
back to the agreement. One `LEFT JOIN` and one selected column were added to
`GET /v1/contracts/:campaign_influencer_id`:

```
LEFT JOIN collab_agreements ag ON ag.id = ci.agreement_id
...
ag.terms_json->>'mode' AS agreed_mode
```

`LEFT`, deliberately: a campaign built without a prior handshake is ordinary, and the join
must never be able to make a contract disappear. There is a test for exactly that.

Still no migration, and still no change to what is stored.

## Three copies of the question, not one

The survey found the same three-way question in **three** places, not the one the founder
reported. All three are now the same two questions in the same words:

1. The collaboration request — what was reported.
2. The contract draft — asked again, remembered nothing, different vocabulary.
3. The production set-up panel further down the same contract screen — asked a third time,
   and it **wrote immediately on tap**, so tapping "Remote" committed before the brand had
   been asked whether a box was moving. It now waits for both answers.

A fourth was found and deliberately left alone (below).

## Also changed, not in the mockup

**The creator can counter the working style**, and her counter offered the same retired
three chips. Leaving it would have put the two sides back out of step on the one screen
this change exists to align, so it now asks her the same two questions. Her counter is
also guarded: remote with the shipping question unanswered is refused rather than being
silently read as "no".

## Knowingly left alone

* **Brand web** (`campaigns/[id]/influencers`) still has the three-way picker. Out of scope
  by the founder's standing instruction that the phones come first and brand web is later.
  It writes the same three values, so nothing breaks — the words just do not match the
  phone yet. **Worth doing when brand web is next opened.**
* **Creator's contract screen** shows "Shipment production" for a live shipment. That is
  describing a parcel that exists, not asking a question, so it stays.

## Evidence

* Mapping tests: 15 new, all green.
* Mobile suite: **159/159** (was 144 — the 15 new checks, nothing else moved).
* Bundle builds clean — the check that matters here, since no test imports these screens.
* Backend `tests/contracts.test.js`: **21/21**, including two new ones asserting the
  payload carries `agreed_mode` and that a contract without an agreement still returns.
