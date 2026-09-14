# item6-negotiation — workflows

## W1 — The creator answers with a counter (N1, N2, N3)
Invitation screen → **Counter** (shown only while `canCounter`) → the N1 choice sheet: "The money and
the work" or "The posting date or the mode", with "You can counter twice in this collaboration. This
would be your first." → money and work goes to `CounterScreen`, the date or mode to `MoveRequestScreen`
(W3). `GET /influencers/me/invitations/:ciId/thread` fills both. The counter screen shows the round
pill, the locked "🔒 Can't be changed" card (Aim, mode and city, selling scope, the follower offer),
the fields the Aim allows, a change line under each, a note ≤ 300 and the "{Brand} can accept this,
counter once more, or decline" hint. Nothing changed is refused on the phone in the server's words.
**Send** → `POST …/counter { terms, note? }` → a turn is written, `round_limit` stamped on the first
counter, `current_turn` flips to the brand, the brand is notified.

## W2 — The brand answers (N7, N8, N9)
Set detail → a row under "Your move" → `GET /campaigns/:id/sets/:sid/invitations/:ciId/thread` →
`BrandThreadScreen`: newest turn first, the invitation always last as plain values, the state box, and
what she may do next. **Accept** → `POST …/thread/accept` → the invitation's four term columns are
rewritten, `answered_at` set, outcome `agreed`, the negotiation ended, the creator notified and the
contract drafted. **Counter back** → the N8 sheet with "ROUND 2 OF 2 · YOUR LAST", the below-minimum
warning that never blocks, and `POST …/thread/counter { terms, note? }`. **Decline** → the N9 sheet
with an optional reason she sees → `POST …/thread/decline { note? }` → `rejected_by_brand`, outcome
`declined_by_brand`. The creator's own mid-thread decline is `POST …/thread/decline { reason, note? }`
with one of item 5's five reasons.

## W3 — Asking to be moved (N4, N10, N11, N12)
`MoveRequestScreen` → a new posting date (today + 7 at the earliest), a mode, or both, plus a note →
refuses the date the set already has → the grey box explains it is not a counter and costs no round →
`POST …/move-request { goLiveDate?, shootMode?, note? }` → **the invitation's status does not change**;
`move_requested_at` is written and the row appears to the brand under "Your move" with "Asked for
27 Oct". One request per invitation.

The brand answers on N10 with three buttons → `POST …/move-answer { answer: 'agree' | 'keep' | 'decline' }`.
**Agree** opens the N11 confirm spelling out the three things that happen, then ends an open thread as
`moved`, closes the invitation as `deferred` ("Moved to your pool"), and writes a `brand_creator_pool`
entry carrying the invitation's terms as they stand. **Keep** is one tap with no confirm, leaves the
invitation exactly as it was, and notifies her with N12's middle sentence. **Decline** ends the
invitation. N12 shows all three endings on her Collabs cards.

## W4 — The pool (N13, N14, N15, N16)
Campaigns → the pool row at the top → `GET /brands/me/pool` → grouped by the date asked for, one Aim
at a time, with days left, the amber "Closing in {n} days" under seven and "· no longer possible" for a
wanted date now inside seven days. **Build a set from a group** → `POST /brands/me/pool/set-defaults` →
item 4's new-set screen pre-filled with Aim, mode, branch and posting date (empty when the date is no
longer possible), and item 5's terms screen pre-filled with the agreed money. Sending marks each entry
`used` — for good. The creator sees her side at `GET /influencers/me/pool`; either side may remove an
entry (`DELETE …/pool/:entryId`). Expiry, the seven-day warning and the closing notification run in the
housekeeping job.

## W5 — From the pool to a fresh invitation (N17)
Item 5's send is unchanged except that a pool creator's row carries `source = 'pool'` and
`pool_entry_id`. Eligibility is re-checked at that moment, so a creator who has since become ineligible
is caught at send exactly as in item 5. The creator's invitation shows a "from the pool" line: with the
date she asked for, "The 20 Oct date and the 12% you agreed on 13 Sep"; with any other date, "The 12%
you agreed on 13 Sep" and nothing about the date.

## W6 — The switch and the set (N18, N19, N20)
`allow_negotiation` sits on the new-campaign screen, on by default, and on the campaign ⋯ menu, and is
changeable at any time. Off → the creator has no Counter and one plain line says why (N19); the API
refuses. The set's creators block (N20) orders **Your move** first, then Negotiating, accepted, signed,
waiting, deferred ("Moved to your pool"), declined, expired, withdrawn. A row with a conversation opens
the thread; a row without one opens the invitation.

## W7 — Admin platform settings (N22)
`/admin/settings/platform` → `GET /admin/platform-settings` (any admin role) → the three numbers with
their descriptions, ranges and the audit line at the foot → `PATCH /admin/platform-settings`
(`settings` capability) → out of range is refused with "Enter a number between {min} and {max}.", one
audit row per changed key, the 60-second cache busted on write.

## W8 — Legacy doors, unchanged callers
`POST /offers/:id/negotiate`, `GET /negotiations/:id` and the rest of the legacy negotiation routes now
call the same `negotiation.service` with the snapshot in `'legacy'` mode, so pre-item-5 invitations
still validate. Every rule — rounds, turn order, the cutoff, the switch, the nothing-changed refusal —
is enforced once, in the service, for both doors.
