# Drift — slice F (board F · actions and statuses, frames F1–F8)

Format: test file · test name · what it asserted · what it asserts now · frame / decision.

Every line below is assertion drift against the board the founder locked on 2 Oct 2026. Nothing was
skipped, deleted or weakened: each changed assertion now pins the new behaviour, and is stricter
than the one it replaces.

## Assertions rewritten

- `src/screens/brand/__tests__/item7Brand.test.js` · "P2 · P3 — shows exactly what she will see,
  says nothing can be edited, and sends on a confirm" · `getByText('DRAFT · DRAFT')` (the word was
  printed twice on the preview) · the reference line's text is exactly `DRAFT`, and
  `DRAFT · DRAFT` is absent · frames F4 / F5, research C08 ("print a single DRAFT").
- same test · the stand-in for a sent agreement was `AG({ status: 'pending_influencer' })`, which
  still carried the creator's signature and `can.sign` — an agreement that cannot exist · the true
  sent-and-unsigned shape (no signature, `can.withdraw`) · frame F4, research C08 FIX RISKS ("the
  fixture needs correcting to a true sent-unsigned shape").
- same test · it stopped at "the send API was called" (the screen then called `goBack`) · it also
  expects `navigation.replace('BrandAgreement', { …, preview: false, toast: 'Agreement sent.' })`
  and that `goBack` was NOT called; and that the preview shows no signature box and no waiting
  sentence · frame F4, check 21.
- `item7Brand.test.js` · "P14 — is possible only while she has not signed, and says what to do
  instead" · it stopped at "the withdraw API was called" (the screen then called `goBack`) · it
  also expects `navigation.navigate('BrandSetDetail', { campaignId, setId, toast: 'Agreement
  withdrawn.' })` and no `goBack` · frame F6.
- `item7Brand.test.js` · "P1 — two different 'your move's sit together" · `getByText('Send
  agreement')` / `getByText('Sign')` on two green pills · the same two exact texts (the label is
  still its own Text), now inside `chip-r1` / `chip-r2` with role `button` and a `chevron-right`
  icon beside the label; plus the agreement that is out is under `group-waitingCreator` ("Waiting
  for the creator") with a "Waiting to sign" tag, `group-waiting` is gone from that fixture, and the
  signed row carries "Active" · frame F1, checks 19 / 20.
- `src/screens/brand/__tests__/item6Brand.test.js` · "N20 — 'Your move' first, then Negotiating
  with a Waiting chip, then item 5's groups" · `getAllByText('Your move').length >= 2` (the two
  rows' pills) and a single `getByText('Waiting')` · "Your move" exactly once (the group heading —
  each row's move is a named button), "Reply" exactly twice as buttons (`chip-r1`, `chip-r2`),
  "Waiting" exactly twice as tags (`tag-r3` the brand's counter, `tag-r4` the unanswered
  invitation); and the "Reply" button opens the same conversation the row does · frame F1 (the
  "Reply" row; "Waiting" on an unanswered invitation).
- `src/components/shoot/__tests__/shoot10.test.js` · "the brand's set row before the plan is sent ›
  says the plan is his move and the chip opens the visit" · `getByText('Your move')` on `chip-ci1`
  · `chip-ci1` reads "Plan the visit", "Your move" is absent; same testID, same press · frame F2,
  spec U11.
- `shoot10.test.js` · "a plan that is out and waiting on her carries no chip" · "Your move" absent ·
  unchanged, plus: no `chip-ci1`, and `tag-ci1` reads "Waiting" · frame F2.
- `src/screens/brand/__tests__/item8Brand.test.js` · "T7 — the accept sheet says the money is agreed
  and a collaboration is NOT started" · `navigate('CampaignsTab', { screen: 'BrandPool', params:
  { highlight: 'e1' }, initial: false })` · the same jump with `params: { highlight: 'e1', toast:
  'Tanvi is in your pool.' }` · frame F8, check 25.
- `src/navigation/__tests__/pushedScreensHaveBack.test.js` (not in this slice's list — the smallest
  edit, one assertion) · "after Accept she is taken to the pool with the Campaigns page under it…" ·
  the same `navigate` call as above · the same call with the `toast` · frame F8.

## Assertions added to existing tests (nothing replaced)

- `src/screens/influencer/__tests__/item7Creator.test.js` · "P4 — it stays under Invites…" · the
  `card-chip-toSign` tag reads "Your move"; the card carries `card-action-ci1` "Review & sign", which
  opens the agreement exactly as the card does · frame F7.
- same file · "P16 — the Active tab is real…" · `card-chip-signed` reads "Active", there is no
  button, and the `card-agreement-ci1` link opens `Agreement` · frame F7, check 24.

`card-chip-<group>` is still keyed on the server's group, also when a signed card reads "Your move".

## New tests

`src/screens/__tests__/actionsStatuses.test.js` — 71 tests for checks 19–26: the two new pieces
(the row button, the icon tag) and their colours and contrast; the rule that picks one per set row,
state by state; the two-line row; every button and its row opening the right screen; the "Waiting
for the creator" group, its order and counts; the ⋯ menu's two agreement lines; the both-signatures
strip; the set after a Withdraw; the sent agreement (message, waiting sentence, "Not signed yet"
twice, the quiet Withdraw); a refused Send and a refused Withdraw inside their sheets; the creator's
cards; the two pitch messages (including the real stack router going BACK with the message); and
the three drifted colours.

## Review fixes (2 Oct 2026) — three findings, all three real, all three fixed

### 1 · A store visit whose time is still being agreed told both sides the opposite of the truth

The first build read the visit's turn off its stage: `sent` → the brand's row "Waiting", her card
"Your move". But `sent` is the stage on BOTH sides of the visit's conversation — once she asks for
another time (or asks to move an agreed one) the stage is still `sent` and the turn is the brand's.
The turn lives on the conversation (`negotiations.production_event_id`), which neither list read.

Fixed with the reviewer's first option — the server says whose turn it is — because the second
("assert no turn at `sent`") would have removed the third card of frame F7, which draws exactly
this stage as "Your move" + "Open".

- **Server, one additive field (outside this slice's file list — the smallest edit that fixes it):**
  `backend/src/services/invitationRows.service.js` — `shoot.yourMove` (boolean) on the brand's set
  row and on her card. Brand: the plan not sent, her visit to confirm, an agreed time that passed,
  or — while the time is contested — the conversation waiting on him. Creator: the plan with her
  to answer, or the conversation waiting on her. Nothing is stored differently; older app bundles
  ignore the field.
- **Phone:** `steps5.setRowStep` at stage `sent` — `yourMove: true` → a "Reply" button that opens
  the visit; `false` → the "Waiting" tag; not sent at all (an older server) → neither, the row
  still opens the visit. `steps5.herMoveOnActive` for a visit is the server's flag and nothing else.

Assertions rewritten for it (all in tests this slice wrote or had already rewritten):

- `src/screens/__tests__/actionsStatuses.test.js` · "'Active' shows only when neither side owes a
  step (U11)" · a `sent` visit with no flag was a "Waiting" tag · the same row with the server's
  `yourMove: false` is the "Waiting" tag; with no flag it is `null` (new test "a visit whose time
  is being agreed: the turn is the server's, never the stage's") · frames F2 / F7, review finding 1.
- same file · "whose turn it is on an Active card…" · `herMoveOnActive` was `true` for stage `sent`
  · `true` only with `yourMove: true`; `false` with `yourMove: false` and with no flag · frame F7.
- same file · "the tag and the button each state gets" · `cardStep` of a `sent` visit was "Your
  move" + "Open" · that only with `yourMove: true`; "Active", no button, otherwise · frame F7.
- same file · "Active, and it is her turn: an amber 'Your move' tag…" · the card fixture gains
  `yourMove: true`; every assertion unchanged · frame F7.
- `src/components/shoot/__tests__/shoot10.test.js` · "a plan that is out and waiting on her carries
  no chip" · the fixture gains `yourMove: false`; every assertion unchanged · frame F2.
- `backend/tests/item10-flow.test.js` · "the brand's set-detail row says where the visit is, and
  chips Your move when he owes the confirmation" · `shoot` was exactly `{ stage, line, visitAt }` ·
  exactly `{ stage, line, visitAt, yourMove: true }` (the one exact-equality on the block; the
  field is additive) · review finding 1.

### 1b · Found while fixing it: the Remote line on both lists never moved (a server defect)

The two list queries work out the Remote facts (her address sent, the parcel booked, delivered,
lines still unchecked) inside a sub-query and then did not name those four columns in the outer
list of columns, so they never reached the row: on both lists a Remote shoot read
"Waiting for her delivery address" / "Send your delivery address" from signing until she marked
the shoot done. Nobody saw it because nothing drew the line until this slice — which then drew a
"Waiting" tag on the brand's row and "Your move" on her card for the whole shoot. Proved red first
(`backend/tests/ui-walk-fixes-shoot-turn.test.js`, the Remote test, before the change), then fixed
by naming the four columns in both queries. No existing assertion changed.

### 2 · A finished Pay for Content row read "Completed." with a green "Active" tag

`steps5.setRowStep` now gives a signed row whose collaboration has finished (`row.status ===
'completed'`) the purple tag when nobody owes a step — "Completed · selling" for the selling one
(as before), "Completed" (new word `C5.set.completedTag`, the server sentence's own word) for the
rest. A row that reads "Reported to INFLX." is no longer "Active": it carries the "Waiting" clock.
No existing assertion changed; new tests only.

### 3 · Nothing drew the Creators tab being handed "Pitch rejected."

New tests only: `BrandCreatorsScreen` rendered with `{ segment: 'Pitches', toast: 'Pitch
rejected.' }` shows the message from the first moment and once the list has loaded, clears the
param, and stays on Pitches; and shows nothing when no message is handed to it.

### New tests added by the review fixes

- `backend/tests/ui-walk-fixes-shoot-turn.test.js` (NEW, 4 tests, through the real endpoints): the
  visit's turn on both lists at every step — plan, her counter, his counter, agreed, her move
  request, the time passing, attended, confirmed — agreeing with the two shoot screens; the plan
  accepted directly with no conversation; the field is additive (the block's keys, the sentences);
  the Remote line and stage on both lists from address to shoot done.
- `actionsStatuses.test.js` — 10 more (81 in all): the visit turn rule; the row with no flag;
  "Reply" as a door on the set screen; the older-server row still opens the visit; the finished
  rule and its drawing; the reported rule; her card after she has countered; the two Creators-tab
  tests.
- `shoot10.test.js` — 2 more: "Reply" once she has asked for another time; neither button nor tag
  when the server does not say.

## Behaviour that moved with it (for the walk)

- `BrandSetDetailScreen` · a signed store-visit row whose plan is out · "Waiting" whatever had
  happened since · "Waiting" while it is with her, a "Reply" button once she has asked for another
  time. The sentence above it is still the server's "Plan sent for … — waiting for {name} to
  answer" in both cases (spec U11 keeps the sentences) — see the follow-up in the slice report.
- `BrandSetDetailScreen` / Collabs · Remote rows and cards · the first Remote sentence for the
  whole shoot · the sentence for where the shoot actually is.
- `BrandSetDetailScreen` · a tap on a "Send agreement", "Sign" or agreement-sent row opened the ⋯
  menu (or an old conversation, if she had countered earlier) · it opens the agreement. The old
  conversation is still in the ⋯ menu ("Open the conversation"). · frame F1.
- `BrandSetDetailScreen` · a tap on a signed Remote row opened the ⋯ menu · it opens the Remote
  shoot, and the row shows the Remote progress line · frame F2.
- `BrandSetDetailScreen` · pills "Your move" / "Waiting" / "Another set" / "Completed · selling"
  took a press of their own · tags take none; the row is the door. Buttons keep `chip-<id>`; tags
  are `tag-<id>`.
- `BrandSetDetailScreen` · the "waiting" group's count was the server's · when an agreement is out
  it is the server's count less the agreements the phone can see (they are counted under "Waiting
  for the creator"). Rows the server only counted (beyond 50 in a group) stay under "Waiting to
  answer".
- `BrandAgreementScreen` · Withdraw was a solid red block · red outline (`DangerButton outline`) ·
  frame F4 ("the only button is a quiet Withdraw").
- `BrandAgreementScreen` · a refused Send / Withdraw raised a toast behind the sheet and left the
  sheet open · the reason is inside the sheet; closing a sheet that showed one reloads the
  agreement · frame F5.
- `components/invitations/copy5.js` `GROUP_TONE.signed` · `completed` (purple) → `active` (green).
  It also colours the "…is in your wallet. Signed 14 Sep." box on an Active card and the state
  pill on the creator's Invitation screen for a signed invitation, which are now green too.

## Closing items (2 Oct 2026) — spec U25, the creator's cards

Format as above. Nothing was skipped, deleted or weakened.

### Assertions rewritten

- `src/screens/__tests__/actionsStatuses.test.js` · "F7 — the creator's Collabs cards › the tag and
  the button each state gets" · `cardStep` was `null` for the group `invited` whatever the card
  said (it sat in the "no step" list with accepted, pooled, deferred, declined, expired, withdrawn,
  closed) · `invited` is out of that list — the other seven are still asserted `null` — and has a
  test of its own ("U25 — a brand-new invitation: "Your move" + "Open" only when it is hers to
  answer") · spec U25(b), check 24.
- same file · "Active, waiting on the brand: "Active" is GREEN (it was purple), with a tick and no
  button" · for a Remote card at stage `sent` it asserted the server's sentence on
  `remote-line-ci1` ("Address sent — waiting for your products") · the same card now carries the
  labelled row `next-line-ci1` — "Next" in grey, "They ship your products" in bold at the right —
  and `remote-line-ci1` and that sentence are absent; the green tag, the tick and "no button" are
  asserted as before · frame F7 (card d), spec U25(a).

### New tests (5, `actionsStatuses.test.js` — 86 in all)

- "U25 — a brand-new invitation: "Your move" + "Open" only when it is hers to answer" — the rule
  (`steps5.hersToAnswer` / `cardStep`): hers; hers with countering off; her own open-group
  application (`canAnswer: false`); a date request the brand has not answered; the brand answered
  "kept" (hers again); a card that does not say she may answer.
- "U25 — Invites: the invitation she can answer has the amber "Your move" tag and an "Open"
  button…" — the three cards drawn on Collabs › Invites: tag colours and icon, the button's look
  and what it opens, the card's own lines untouched, and neither tag nor button on the other two
  (the third still opens its conversation).
- "U25 — what comes next on an Active card: only where the next step is the brand's to START" —
  the rule (`steps5.cardNext`), stage by stage, including everything it must NOT claim.
- "U25 — Active, a store visit the brand has not planned yet: green "Active", the labelled row
  "Next · Urban Threads plans your store visit", the Agreement link, and no button".
- "U25 — every other stage keeps the server's sentence with no "Next" label".

### Behaviour that moved with it (for the walk)

- Collabs › Active · a signed Store Visit collaboration whose plan the brand has not sent · the
  card said nothing about what comes next (the server sends no visit line until a plan is out) ·
  "Next · {Brand} plans your store visit". Read from what the card carries: signed by both, a
  store-visit set, and no visit, Remote, content or going-live block from the server.
- Collabs › Active · a Remote collaboration, her address in, nothing shipped · the server's
  "Address sent — waiting for your products" · "Next · They ship your products" in its place.
  Every other Remote stage, and every store-visit stage the server describes, keeps the server's
  sentence with no label.
- Collabs › Invites · a brand-new invitation she can answer · no tag and no button · the amber
  "Your move" tag (testID `card-chip-invited`) and an "Open" button (`card-action-<id>`) that
  opens the invitation, as the card does. Her own open-group application and an invitation
  waiting on the brand's answer to a date she asked for are as they were: neither.
- `components/agreement/copy7.js` · new phone-only words `C7.creator.next` ("Next") and
  `C7.creator.nextTheyPlanVisit` ("{Brand} plans your store visit"); `nextTheyShip` ("They ship
  your products") is drawn for the first time. The never-drawn key `nextBookVisit` ("Book your
  store visit") is removed: it told HER to book a visit that is the brand's to plan.
