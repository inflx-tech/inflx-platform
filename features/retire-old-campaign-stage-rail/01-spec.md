# Retire the old campaign stage rail

**The founder, 2026-08-27: "remove that old screen now."**

---

## 1. What it is

`BrandCampaignDetailScreen` renders a six-stage strip:

> **Fund · Roster · Contracts · Production · Review · Payout**

It comes from `utils/campaignStages.js` (`CAMPAIGN_STAGES`, `stageTrack`) via
`components/brand/CampaignStageRail.js`, and is drawn at `BrandCampaignDetailScreen.js:311`.

## 2. Why it goes

Stage 3 agreed a **different** six, decided server-side and shown per creator:

> **Agree · Sign · Shoot · Shop posts · Go live · Complete**

Two six-step vocabularies in one app, with half the words colliding — `Contracts`/`Sign`,
`Production`/`Shoot`, `Review`/`Shop posts`. They do not even measure the same thing: one is the
campaign, one is a single collaboration.

This is the **two things doing one job** fault. It cost Stage 1 four of its twenty-one bugs and
Stage 3 an entire deleted file. The founder spotted it in a screenshot.

`git log` confirms Stage 3 never touched this screen: its last three commits are a recolour, a
Part-5 date change and a restyle.

## 3. What stays

**`PrimeBar` stays.** It sits directly below the rail and carries the one primary action —
*"Fund wallet & publish"*, *"Review 3 applications"*, *"Confirm 1 live URL"*. That is genuinely
useful, it names no competing six, and it is the action mobile never had before.

`deriveCampaignStage` returns `{ stageKey, prime }`. Only `prime` survives.

## 4. What is removed, not just hidden

Leaving the vocabulary in place with nothing rendering it is how a dead idea gets rebuilt by
somebody in six months. So:

| Removed | Why |
|---|---|
| `<StageRail />` from the screen | the strip itself |
| `StageRail` from `CampaignStageRail.js` | its only caller is gone |
| `CAMPAIGN_STAGES`, `stageIndex`, `stageTrack` | the competing six, in words |
| `stageKey` from `deriveCampaignStage`'s return | nothing reads it once the rail is gone |

**Renamed**, because a file called `campaignStages` that contains no stages is a trap:

* `utils/campaignStages.js` → `utils/campaignPrime.js`
* `deriveCampaignStage` → `campaignPrimeAction`
* `components/brand/CampaignStageRail.js` → `components/brand/CampaignPrimeBar.js`

## 5. Two tests must be rewritten, not deleted

* `campaignStages.test.js` — its `stageTrack` block tests something that no longer exists. The
  `prime` half is still valuable and moves across intact.
* `brandCommandCenter.smoke.test.js` — asserts `StageRail` is exported. That becomes false, so
  it must assert the opposite fact rather than losing the coverage.

## 6. Out of scope

**Rebuilding the campaign screen around Stage 3's six is NOT in here.** The founder first chose
that as its own stage, then asked for the strip gone now. This removes the wrong thing; it does
not build the right one. The screen keeps its progress figures, its tiles and its prime action.
