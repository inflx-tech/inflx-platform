# item5-invitations — workflows

## W1 — Add creators (I1)
Set detail → "Add creators" (only while `set.canInvite.ok`) → `GET /campaigns/:id/sets/:sid/pickable?tab=all|worked&…`
= the item 3 list plus `pick { state: ok | invited | ineligible, label }` per row → checkboxes; Invited
rows ticked and locked; ineligible rows locked with "Not open to this set" → "Next: terms for {n}
creators" starts the in-app draft (`components/invitations/draft5.js`) → W3.

## W2 — Invite a group (I2)
Groups tab → a group → `GET …/group-check/:groupId` → "{k} of {n} can be invited", the avatar stack,
the cannot list with "Not taking invitations" / "Not open to this set" / "Already in this set" →
"Next: terms for {k} creators" starts the draft with the group remembered (`sourceGroupId`).

## W3 — Terms, creator by creator (I3, I4, I5)
`POST …/eligibility` once per draft → minimums per creator (brand only). One screen keyed by the set's
Aim: locked set card; the fields the Aim needs; the amber "Below {first}'s minimum of {v}…" box that
never blocks; "Use these terms for everyone" (money, scope, deliverables, usage rights, a saved offer;
never a special offer); the offer sheet (I6) and the special-offer sheet (I7) with the preview from
`POST /campaigns/preview-basket`; a commission above 50 asks once. Next creator → Review and send.

## W4 — Review and send (I8)
`POST …/eligibility` with the typed money → OK / Below min per row and the warning line → "Send {n}
invitations" → `POST /campaigns/:id/sets/:sid/invitations { creators: [{ influencerId, terms }], sourceGroupId? }`
→ server: set checks once (exact messages), every creator prepared, then one transaction with the set
locked, rows written with `invited_at`, `invited_by`, `source`, `source_group_id`, `brand_note`,
`usage_rights_json`, the offer snapshot → notifications after commit → 201 `{ sent, rows, set }` → back
to the set with "{n} invitations sent." A 422 with `details.failures` marks the rows and offers "Remove
{n} and send the rest".

## W5 — The set after sending (I9, I10)
`GET …/summary` now carries `creators { order, groups { key, title, count, rows[≤50], more } }`. Rows
⋯ → View terms sent (`GET …/invitations/:ciId`) · Open profile · Withdraw invitation
(`POST …/invitations/:ciId/withdraw`, `invited` only) · Remove from set (`POST …/remove`, until both
signatures). "Send agreement" is item 7's chip. Deferred rows sit under "Asked for another date".

## W6 — The creator (I11–I15)
Collabs · Invites → `GET /influencers/me/invitations?tab=invites` (live + ended within 7 days; `done`
for the rest) → cards → `GET /influencers/me/invitations/:ciId` → the locked set block, "Your terms",
the note, "Nothing is final…" → Accept (`POST …/accept`, confirm first) · Counter (only when
`canCounter`; opens the placeholder) · Decline (`POST …/decline { reason, note? }`, one of five reasons,
note ≤ 200). After the cutoff the actions disappear and the invitation reads as expired; the server
refuses with "This invitation closed on {date}."

## W7 — Legacy doors, unchanged callers
`POST …/invite` (the brief) → `invitationSend.sendLegacy` (same gates, terms validated in legacy mode).
`POST /campaigns/:id/influencers/:ciid/cancel` (website "Cancel assignment") → the remove. `PATCH
…/influencers/:ciId` → refused for every row. `/offers/inbox`, `/offers/:id`, `/offers/:id/accept`,
`/offers/:id/decline` keep working with the leaks stripped and the shared answer service.
