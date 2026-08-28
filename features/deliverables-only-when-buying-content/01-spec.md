# Deliverables exist only where the brand is buying content

**Founder, 2026-08-28, when his countersign was refused:**

> *"content related reels and all is come mandatory only in pay for content type of campaign"*

He had briefed Asha on a commission campaign, she had signed, and the app refused his
counter-signature with:

> *"Contract signing failed: Cannot create contract: campaign set has no deliverable formats.
> Add at least one format (reel/post/story/...) before signing."*

---

## 1 · Three places answered one question, three different ways

| Where | On an empty format list | Verdict |
|---|---|---|
| `BrandSetWizardScreen` | sends `formats_json: []` | **right** — it already knew |
| `contract.brandSign` | throws 422, refuses the whole countersign | **the reported bug** |
| `getMyCampaignDetail` | falls back to `[{ type: 'reel', count: 1 }]` | **invents work she never agreed to** |

One refuses, one fabricates, and the phone that produced the data disagrees with both. The
wizard's line reads:

```js
formats_json: buyingContent ? formats.filter(f => Number(f.count) > 0) : []
```

It had the founder's rule correct all along. **The server was never told.**

This is the "two things doing one job" fault, for the fifth time in this codebase.

## 2 · Why commission work has no deliverables

A commission creator is not selling content — she is selling **product**. The brand pays nothing
up front and owes nothing if she posts nothing; she earns only when someone buys through her link.

There is no deliverable to be late on, revise or approve, **because nothing was bought.**

A brand paying a **fee** is buying specific content and must say what. There the requirement
stands, and stays a hard error.

## 3 · One rule

`services/deliverables.model.js` — `buysContent(goal)` and `plannedDeliverables(goal, formats)`.
Both call sites ask it. It never throws; the caller decides what a problem means.

The error text changed too. The old one named a JSON column at a brand who has never seen one:

> ~~*"campaign set has no deliverable formats configured … formats_json"*~~
> **"This campaign pays for content, so the set has to say what content. Open the set and add at
> least one format — a reel, a post, a story — before signing."**

## 4 · The consequence I had to handle

Letting a commission collaboration through with **zero** deliverables strands her: `deriveStage`
leaves `shoot` only on deliverable progress she will never have. She would read *"The shoot —
settle the time, confirm what arrives, and shoot"* for the whole campaign.

She was never functionally blocked — her link, tracking and earnings are all reachable from that
screen — but the headline was a lie.

So `heroFor` now says the true thing for a commission collaboration with nothing to deliver and
no shoot arranged:

> **You are live** — *Share your link and earn on every sale it brings.*

⚠️ **No seventh stage is invented.** A commission collaboration that *does* have a store visit or
a parcel still gets the shoot, because that is real work with a real screen.

## 5 · Out of scope

* Moving a commission collaboration to `done` — that still needs someone to complete it, exactly
  as before
* Whether the brand app exposes editing formats on a live set (the API allows it)
