# Workflow — Web Campaigns tab as a monitor

> Each numbered step becomes an assertion in `03-expected-outputs.md`.

## Actor
A logged-in, approved brand on `inflx.in/dashboard`. The same brand has built campaigns on the
phone: at least one with invitations sent (live), one with none (draft), one whose sets are all
completed or expired (past).

## Preconditions
- Phone-built data as above. No old-style (web-built) campaign is required; if one exists it
  follows the same derived state as everything else.
- No change on the server. No migration.

## Workflow A — the list

1. Brand opens **Campaigns** in the top nav → three segments **Live · Drafts · Past** with the
   counts from `tabs.*`. **Live** is selected first (as on the phone).
2. Each card shows: name · state chip · "N sets · next posting {d Mon}" (drafts: "no invitations
   sent") · a signed-of-invited bar · "X invited · Y signed · Z waiting · N declined".
3. Brand types in the name filter → cards narrow client-side; segment counts do not change.
4. There is **no** "New campaign", no bulk bar, no Export, no signature strip, no status chips, no
   budget tile. A one-line note under the header: "Campaigns are built and run in the INFLX brand
   app on your phone. This page shows what is happening and the numbers."
5. Brand with no campaigns → the same sentence as an empty state, no button.
6. Brand clicks a card → the hub.

## Workflow B — the hub

7. Header: name · state chip · description · "Negotiation on/off" · "Started from group X" (when
   present) · totals strip invited / signed / waiting / declined.
8. **Sets** block: Current sets then Past sets. Each set row: name · Aim word · mode word ·
   branch and city (Store Visit only) · posting date · "cutoff {date} · N days" or "Invitations
   closed" or "Date passed" · state chip · "X invited · Y signed · Z waiting · N declined".
9. Brand clicks a set row → a right-hand drawer loads `sets/:sid/summary` and lists creators in
   the phone's nine groups and order, each row with avatar, name, handle, the terms line, the
   agreement line, the shoot or Remote line when present, and dates. A group row marked
   "Your move" carries the hint "On the phone: Campaigns › {set}".
10. When the set's Aim is not Pay for Content, the drawer has a **Posts** tab: the posts list
    with code, title, creator, state, goes-live date, social views/likes/comments or "Social links
    not added yet", in-app views/likes/comments, and the totals row (orders, sales, commission,
    INFLX fee, you receive).
11. **Numbers** block (unchanged data, re-laid): Engagement totals + "Update now" (D4, disabled
    when `canUpdate` is false, shows `lastUpdateNowAt`) · Store clicks total with by-set rows ·
    Conversions totals (sales, revenue, commission paid, blended ROI) with by-channel · Payout
    (summary, per-creator tranches, or the commission-only sentence when `has_tranches` is false).
12. **Needs you on the phone** panel (right rail): counts derived from the summary and drawer
    data already loaded: agreements waiting for your signature (rows with
    `actions.signAgreement`), creators waiting for your reply (`group === 'yourMove'`), shoots
    waiting (`shoot.yourMove`). Each line is text plus "Open the INFLX brand app"; nothing is
    clickable into an action.
13. There is no publish, end, cancel, delete, sign, approve, reject, counter, invite, or
    production control anywhere on the hub or its drawer.
14. Brand opens `/dashboard/campaigns/{id}/influencers`, `/sets`, `/reviews`, `/escrow` by URL →
    each redirects to the hub (`/sets` and `/reviews` already do; `/influencers` and `/escrow`
    join them).

## Workflow C — the side doors

15. Dashboard home: tile "Live campaigns" = `tabs.live`, sub "{total} total"; Recent campaigns
    rows use the list card line; quick action reads **Campaigns**.
16. Listings publish step: the first next-action card reads "Run a campaign on the phone" with
    the phone sentence, no href to a create.
17. Creator profile page (`/dashboard/influencers/{id}`): the "Invite to campaign" button and
    modal are gone; in their place one line: "Invite her from the INFLX brand app: Campaigns ›
    set › Add creators."

## Success definition
The three lists on the web match the three lists on the phone for the same brand, card for card,
with the same chip words, and no network call from the Campaigns tab or the side doors is a
write other than `POST .../engagement/refresh`.

## Failure / edge workflows
- Another brand's campaign id in the URL → summary answers 404 → "Not found" card, link to the list.
- Engagement, clicks, conversions, payout or posts fail → that panel shows "Not available right
  now"; the sets block still renders from the summary.
- Set drawer 404 (set deleted on the phone meanwhile) → drawer shows "This set is gone" and the
  hub reloads the summary.
- Not authenticated → existing dashboard sign-in gate; no campaign call is made.
- A brand with only old web-built campaigns → they still render; their sets carry no posting date
  (`postingDate` null → "no posting date") and no Aim words beyond what the server returns.
