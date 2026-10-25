# Spec — A YouTube channel that only posts shorts must still show its subscribers

> Carved backend defect in item 3b (`features/item3b-social-numbers`). Found 25 Oct 2026 from the
> founder's screenshot of the brand app's Creator screen: a live creator read **YouTube "—"**,
> **Avg video views "—"**, Avg shorts views 646, Recent uploads 30. Approved by the founder in chat,
> 25 Oct 2026 ("pls read and find the problem and fix that").

## The fault, in one example

A creator's channel has only shorts. INFLX measures her the usual way: one Apify run on the
channel's **Videos** tab, one on its **Shorts** tab.

1. The Videos tab has nothing on it, so the actor answers with one error item ("this channel has
   no videos"), the same way the Streams tab answers for a channel with no streams.
2. The Shorts tab answers with her shorts — and every one of them carries the channel's totals
   (subscribers, total videos, total views).
3. The code picks "the first answer that is not a failure" as the channel snapshot. The Videos
   answer is not a failure (it is merely empty), so it is picked, and it has no subscribers in it.
   The Shorts answer, which has them, is thrown away.

The snapshot is stored with **subscribers = blank**, written through to the creator's row, and the
brand sees "—" where her subscriber count should be. Her shorts numbers are fine, which is why the
card looks half-measured.

The same choice sits in the weekly **profile** run (one-item read of the Videos tab only): on a
shorts-only channel it is always empty, and the code wrote a **blank snapshot over the last good
one** rather than nothing. So even a channel measured correctly once would be blanked within a week.

## Where

`backend/src/services/socialCalc.service.js` `youtubeChannel(items)` — reads the totals from the
first non-error item, and returns `subscribers: null` when that item has none.
`backend/src/services/socialMeasure.service.js` `youtubeRun` — `good = !chV.error ? chV : …`
prefers the empty Videos answer; the profile run and the full-run fallback store `{ subscribers: null }`
on an empty answer.

## What is wanted

1. **Totals are read from the first item that carries them**, whichever tab it came from. An
   answer with no item carrying a subscriber count is "empty", never "a channel with no subscribers".
2. **The one-item channel read tries the Shorts tab when the Videos tab is empty** (profile runs,
   and the full-run fallback when neither tab had uploads inside the window).
3. **An empty answer writes no snapshot.** The last good snapshot stays; nothing is ever blanked by
   an empty read. (Not-found and private still clear the numbers exactly as before.)
4. Nothing a person sees changes except the number itself: the screens already print whatever the
   snapshot holds.

## Not in this contract

- "Avg video views —" on this creator is **correct**: she has no long videos in the measured set.
  The tile shows "—" by design (rules v1.12 §2A: a type with 0 uploads is null).
- The actor answering an **empty dataset** (no items at all) is still read as not-found, as today.
  The real probe (11 Sep 2026) showed missing channels answer with a `CHANNEL_DOES_NOT_EXIST` item,
  never an empty dataset; left as it is.
- The probe fixtures' dates (June–Sep 2026) have aged out of the 90-day window, so three older
  item 3b pipeline tests fail on uploads-in-window counts. Pre-existing (recorded in the 11 Oct
  baseline with the same diff), classified stale-fixture, not touched here.
- No migration, no screen, no app update. Existing blank snapshots heal on the account's next
  measurement (weekly profile run, or admin **Measure now**).

## Done means

A test runs the full measurement on a channel whose Videos tab answers "no videos" and whose Shorts
tab carries the totals: the snapshot holds 52,000 subscribers, the creator's row holds 52,000, the
brand payload says subscribers 52000 with avg long views null. A following profile run keeps
52,000 (two Apify calls, Videos then Shorts). A run whose items carry no totals leaves the last
snapshot untouched. All three fail on today's code.
