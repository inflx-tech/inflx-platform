# Stage 1 · A brand and a creator find each other and agree

Plan: `Docs/THE_PLAN.md`. Drawn from **FINAL 1** (`brand-mobile-spine/04-preview/mockups/
final-1-creators.html`, ledger actions 1–58) and `creator-collab-conversations/…/
conversations.html`. Scope is the **three phone apps only** — brand web is a later concern.

## Why this stage is first

It closes the bug the founder reported. A real request sat unseen for Sagar Joshi because a
brand's opening move is filed under Profile documents while every other brand interaction
lives in Collabs. Everything else in the programme assumes two people can reach each other.

## Reality check — verified 2026-08-22 against the running apps and production

**Brand's phone.** No Creators tab (Home · Campaigns · Wallet · Alerts · Profile). Search
exists with a typed-in city. **No** place picker, **no** groups, **no** way to ask a group or
a filtered set — the reach calculation is finished and has never had a screen. Sent requests
and agreed creators **do** exist. Pitch settings **already exist on the phone** — dropped from
scope.

**Creator's phone.** Requests live at Profile → Brand Proposals → third tab. No badge.
Eight stages, not six, and empty ones are hidden. Countering a brand's counter on her own
pitch is finished server-side and unreachable in the app. Nothing can read the negotiation
history.

**Production.** 22 contactable creators (4 Vijayawada, 4 Hyderabad) · 11 conversations across
every state · 6 agreements · 2 groups · **0 of 5 brands accept pitches** · **0 history
entries** (the practice conversations predate the recording).

## Scope — in

1. **Creator: the inbox moves into Collabs.** Six stages — Invitations · Pitches · To sign ·
   Shoot · Content · Done — replacing today's eight. Empty stages stay visible and greyed:
   a strip that changes shape as work arrives is disorienting, and hiding "Done" is part of
   what let the original bug live.
2. **Creator: a badge**, sourced from the count built in Stage 0.
3. **Creator: her rules move** from Profile to the top of Invitations.
4. **Creator: she can counter back on her own pitch.** Server is done; this is the app half.
5. **Brand: a Creators tab** replacing Alerts, with four sub-tabs — Talking · Agreed · Find ·
   Groups. Alerts moves under Profile.
6. **Brand: the place picker** — state → city, searchable, a creator count on every row,
   zero-count rows greyed. Reads the existing lookup.
7. **Brand: groups** — create, rename, delete, add from a profile or in bulk from results.
8. **Brand: ask a group, and ask many by filter**, each with the reach funnel first —
   matched → reachable → capped, every drop named.
9. **Both: the conversation screen**, identical on both phones, with the counter shown as a
   before-and-after diff and required terms absent from the composer rather than disabled.
10. **Both: the history page** — every offer that was ever on the table. Needs one new way to
    read what is already being recorded.
11. **Approved brands become open to creator pitches** (founder decision, 2026-08-15).
    Outward-facing; needs its own go on the day.

## Scope — out

- **No campaign work.** Agreeing terms produces an agreement, not a campaign. Stage 2.
- **No shoot, no posts, no completion** — Stages 4 and 5.
- **Brand pitch settings** — already exist on the phone.
- **Brand web** — later, by the founder's instruction.
- **No in-app role switching.** One number holds several accounts; switching hats inside an
  app is Stage 9.
- **The "Brand workspace" label on the admin sign-in page** — a visible text change, so it
  needs its own mockup and lock.

## Layers

Both phone apps · a small amount of server (read the history) · one database change (brands
open to pitches).
