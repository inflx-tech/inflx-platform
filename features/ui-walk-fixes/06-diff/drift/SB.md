# Drift — slice SB (server · why a creator can't be invited)

Business-rule drift. Founder decision **D2 (2 Oct 2026)** reverses item 5's rule that a brand is
never told why a creator can't be invited (item 5 `PROMPT.md:259/303/305/541`). The assertions
below pinned the old rule and were REWRITTEN to the new one. None was skipped, deleted or
weakened; each asserts the new behaviour for the same situation, and four of the five now assert
more than before. Format: test file · test name · what it asserted · what it asserts now ·
frame / decision.

- `backend/tests/item2-eligibility.test.js` · "1. paused → NOT_ACCEPTING; blocked → NOT_ACCEPTING, identical" · the refusal is exactly `{ ok: false, reason: 'NOT_ACCEPTING', warnings: [] }`, once for paused and once for blocked · the refusal is exactly `{ ok: false, reason: 'NOT_ACCEPTING', warnings: [], detail: 'not_accepting', label: 'Not taking invitations', message: "Priya isn't taking invitations right now." }` for both, the two are byte-identical as JSON, and neither contains the word "block" · D2, frame B10 last row, check 6b.
- `backend/tests/item5-invitations.test.js` · "when one creator cannot be invited, nothing is written and every failure is named" · the paused creator's failure message is `MSG.INELIGIBLE('Ritu V.')` = "Ritu V. can no longer be invited to this set." · her failure is `{ code: 'NOT_ACCEPTING', field: 'influencer_id', message: "Ritu isn't taking invitations right now.", label: 'Not taking invitations', detail: 'not_accepting' }`; the other creator's failure (no commission typed) keeps its message and carries `label: null, detail: null` · D2, frames B2 / B10, check 6a.
- `backend/tests/item5-invitations.test.js` · "pickable rows carry ok / ineligible / invited; a dead row can be picked again" · a creator with Pay for Sale switched off, in a Pay for Sale set, has `pick` matching `{ state: 'ineligible', label: 'Not open to this set' }` · her `pick` is exactly `{ state: 'ineligible', reason: 'NOT_MATCHING', detail: 'aim', label: 'Not taking Pay for Sale', message: "Kavya isn't taking Pay for Sale collaborations.", inSet: 'none' }`; the `ok` and `invited` picks are now asserted field for field too (both unchanged) · D2, frames B1 / B2 / B10 row 1, check 6a.
- `backend/tests/item5-invitations.test.js` · "a group against a set: \"{k} of {n} can be invited\" with the three labels" · the creator who takes Store Visit only, in a Remote set, has `label` 'Not open to this set' · her `label` is 'Not taking Remote', with `detail: 'mode'` and `message: "C isn't taking Remote collaborations."` beside it and the same three inside `pick`; the paused creator's 'Not taking invitations' and the invited creator's 'Already in this set' are unchanged and still asserted · D2, frame B10 row 2, check 6a.
- `backend/tests/item6-negotiation.test.js` · "a creator who became ineligible since joining the pool is caught at send (check 26)" · the failure message is `MSG5.INELIGIBLE('Ritu V.')` = "Ritu V. can no longer be invited to this set." · the failure matches `{ code: 'NOT_ACCEPTING', message: "Ritu isn't taking invitations right now.", label: 'Not taking invitations', detail: 'not_accepting' }`; the pool entry staying `waiting` is still asserted · D2, frame B10 last row, check 6a. (This file is outside the slice's list; the send door it exercises is the one the slice changed, so the one assertion moved with it.)

## Not rewritten, but now reads differently

- `backend/tests/item8-pitch.test.js` · "22. paused and blocked always apply, whatever was agreed" — untouched and still green. Its comment says "The brand is told only that she is not available — never why"; that stays true for paused and blocked (they read the same and name nothing else), which is all the test asserts.
- `backend/tests/item2-settings-api.test.js` · "an invitation to a creator who is not open to the set is refused…" — untouched and still green. It exercises the legacy brief door (`POST …/sets/:sid/invite`, only the website calls it), which keeps its coarse 403 sentence "This creator isn't open to this set." The website is not in this change.

## Behaviour that moved with it (for the walk)

- A creator who can't be invited now says why on every brand list that marks her: Add creators
  (All creators, Worked with, Pool), the "Invite a group" check, the terms check before Review,
  and the refusal after "Send n invitations". One reason only — the first of her rules that
  fails: not taking invitations (paused OR blocked, identical), then the set's Aim, its mode, her
  brand categories, her store-visit cities.
- An app bundle from before this change already prints the server's label under her name on the
  "Invite a group" check, and the server's sentence under her name on Review and send — so those
  two screens show the new reason without an app update. Add creators prints its own fixed
  "Not open to this set" until the new bundle lands.
- The refusal after "Send n invitations" used to read "{Full name} can no longer be invited to
  this set." It now reads the same sentence as the picker ("Asha isn't taking Pay for Sale
  collaborations."). The old sentence survives for one case only: a creator whose account is no
  longer approved.
- A defect found and fixed on the way: the **Worked with** tab inside Add creators (the set
  picker) answered "couldn't load" on every call since item 5 shipped (commit 56e96a8d, 13 Sep) — the page query
  put two joins after its WHERE. No test had ever asked for that tab. It now loads, and is covered.
