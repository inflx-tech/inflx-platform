# Diff notes — posting-date-last-day

Against `04-preview/mockups/posting-date-last-day-mockups-v1.html` (L1 the post row, L2 the
sentences). No screen was added or rearranged, so there is no new "after" shot: the change is which
state a post row shows and thirteen sentences.

## What was implemented
- **Server.** A post is live from approval; an offer post only while its offer is active
  (`shoppablePosts.liveDayOf` / `stateOf`, `shopperPosts.livePool`). The post carries `goes_live_on`
  and `live_since`; the brand's Going live rows carry `goesLiveOn`. Links, codes and the approval
  notice follow. Terms: `creatorTerms.offerChoices` (start on or before the posting date, end at
  least a day after; a third left-out reason, "ends"), `creatorTerms.freeProducts` (free from
  today). One shoot sentence ("her last day to go live").
- **Phones.** Twenty-three sentences in eleven files, and three callers that named the posting date
  where they now name the day the post really goes live (`CreateHomeScreen`, `PostStatusScreen`,
  `BrandSaleLiveScreen`).
- **No switch.** The Admin switch built earlier the same day was removed before anything was
  committed; no migration.

## What matches the mockup
L1: "Live" for an approved post; "Approved · in the shop from <offer start>" for one waiting for its
offer; "Late" for one approved after the posting date. L2: every sentence in the table, word for word.

## Where it differs
- Not on a device yet: the founder's phones after the OTA are the first look.
- Two sentences on the creator's link sheet still read "Goes live on <day>" / "Anyone who taps before
  <day> sees…": they are shown only for a post waiting for its offer, and the day they name is now
  the offer's start, sent by the server.
- Longer sentences that say "before she posts" (shoot and content screens, notices) are unchanged:
  they stay true with the posting date as the last day (spec L6).

## Order of work (stated plainly)
The founder gave the rules in chat and accepted the two recommendations put to him; the board was
drawn alongside the build as the record of the sentences. Lock decision taken under standing
autonomy; nothing deploys without his go.

## Test record
- Four rule suites (shopper-app-v2, shoppable-posts-v2, post-links-codes, creator-terms-v2):
  110 / 110, with the drift listed in `03-expected-outputs.md`.
- Full phone suite 840 / 840.
- Full backend run against today's earlier full run: `backend-compare.txt`.
- Production, read-only, before deploy: one approved post (KNTZXR; offer 1–9 Oct) — it goes live at
  deploy; one collaboration on the new terms (one offer, no products without offers).
