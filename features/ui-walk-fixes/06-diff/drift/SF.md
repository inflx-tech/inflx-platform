# Drift — slice SF (server · a withdrawn agreement can be sent again)

**No existing assertion was rewritten, skipped, deleted or weakened.** Every test that was green
before this slice is green unchanged. Decision U6(a), frames F3 / F6, check 23. Format where a
line applies: test file · test name · what it asserted · what it asserts now · frame / decision.

## Assertions that stayed exactly as they were (named because the brief pinned them)

- `backend/tests/item5-invitations.test.js` · "the set groups creators in the I9 order; …" · the
  group order is `['yourMove','negotiating','accepted','signed','waiting','deferred','declined','expired','withdrawn']`
  · the same, untouched · no server group was added (U9: "a server-side regrouping of set rows" is
  left out; the phone splits "waiting" itself).
- `backend/tests/item7-agreement.test.js` · "withdraw works only before her signature and returns
  her to accepted; the same agreement can be sent again (check 22)" · untouched and still green.

## New tests (behaviour that had no test)

- `backend/tests/item7-agreement.test.js` · describe "a withdrawn agreement can be sent again
  (ui-walk-fixes check 23)" — five tests:
  1. out for signature the set row carries `withdrawAgreement` / `viewAgreement` /
     `agreement.status` / `agreement.sentAt`; after Withdraw the row is in `yourMove` with
     `sendAgreement: true`, in no other group, and the order and the group keys are unchanged (F3, F6);
  2. the brand's own read says `can.send: true`; its ending is still named; her card, her read and
     her Sign are exactly as before (creator side untouched);
  3. sending again by the phone's path — the row, the preview, Send — keeps the same reference and
     the same single contract row, puts the row back out for signature, she signs, the brand signs,
     and the signed row carries `viewAgreement` / `downloadAgreement`;
     STRENGTHENED after review (assertions added, none changed): the preview's `reference` is
     `null` before the first send, the stamped number while it is out, and `null` again after a
     withdraw — while the contract row keeps the number and the second send returns it (F5 / F6);
  4. the read never offers a send the endpoint would refuse: `can.send` is false once it is out
     again and false once the set's cutoff has passed (the endpoint answers 422 in both);
  5. the two new brand sentences are the approved words on the server, and the app's
     `components/agreement/copy7.js` carries them word for word (BUILD_RULES rule 8).
- `backend/tests/item5-invitations.test.js` · "a withdrawn agreement returns an accepted creator to
  \"Your move\" with Send agreement; one who was removed or moved stays put (ui-walk-fixes check 23)"
  — three creators whose contracts all read `withdrawn`: the one whose agreement the brand took
  back is under "Your move"; the one removed from the set stays under "Withdrawn and closed"; the
  one moved to the pool stays under "Moved to your pool"; neither of those two is offered a send.

## Behaviour that moved with it (for the walk)

- Before: after the brand withdrew a sent agreement, her set row sat under "Accepted, waiting for
  the agreement" with no action, and the brand's agreement read said it could not send — while the
  send endpoint accepted it. Latent only because the phone could not reach Withdraw.
- Now: on an accepted invitation, a withdrawn agreement that is not out behaves as a draft does —
  the row is under "Your move" with "Send agreement", and the read says it can be sent (until the
  set's cutoff). An app bundle from before this change already draws such a row correctly.
- Review fix: the preview of a withdrawn agreement used to carry the number stamped at the first
  send, so the phone headed an unsent agreement "INFLX-… · PAY FOR …" (the header of one that is
  out) above "Send for signature". The preview now carries a number only while the agreement is
  out; taken back, it reads "DRAFT" exactly as a first-time preview does. The number is not lost:
  it stays on the contract and is the one the agreement goes out with again. No existing test
  asserted the preview's reference after a withdraw.
- Unchanged: what Withdraw writes; the creator's card and her agreement read; the ending sentence
  on a withdrawn agreement; a contract marked withdrawn because she was removed, moved to the pool,
  or refused a different date.
