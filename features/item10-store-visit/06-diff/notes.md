# item10-store-visit — before/after notes

## Phase 2a — the gate and the mode (backend; one mobile primitive)

**Before:** two of eighteen paths into the shoot checked the signatures; none checked the money.
Every set-first collaboration's shoot row was born `remote`. `DangerButton` accepted `busy` and
dropped it, so four confirm sheets could be double-tapped mid-request.

**After:** `shootGate` / `assertShootOpen` on every path (contract reads, date range, visit
details, all event-scoped routes through `getEventOrThrow`, the brand list as a filter, the roster
and the admin queue as a column, and `autoCreateForContract` itself). The set's `shoot_mode` is the
mode's source. The shoot row is born after the money inside the countersign transaction, in a
savepoint. `DangerButton` honours `busy` exactly as `PrimaryButton` does.

## Phase 2b–2d — the engine, the flow, the retirements (backend, brand-web)

The third negotiation anchor; F1–F8; three jobs; Needs You; the admin number; the retired doors
answering with a sentence; brand-web's visit panel a read-only card. All server-side — see the
build summary for the route table before and after.

## Phase 3 — the screens, against the locked mockups V1–V15

| Mockup | Built | Departures |
|---|---|---|
| V1 Brand · the shoot opens | `BrandAgreementScreen` after both signatures: `GateCard10` (ticks / hourglasses, green / blue), `StepLine10`, the posting countdown, **Plan the visit** → `BrandShoot` | Item 7's "What happened just now" money card stays above the gate card — it is the same money, and removing it would remove the still-locked figure item 9 fixed. For Remote the button keeps its old name and says the Remote shoot arrives with item 11. |
| V2 Brand · the plan | `BrandShootPlanScreen`: locked card (Mode, Branch, She posts on), who to ask for, their number (prefilled with the brand's login number — Q11), `TimePicker10` capped at the posting day, roughly how long, anything to bring | Date and time are one picker (a day strip, hour chips, minute chips in 15-minute steps) rather than two side-by-side fields — the pure-JS picker (Q8) reads better as one control. |
| V3 Brand · sending it | `SendPlanSheet10`: the full address, the number, the time, the sentence about what she can and cannot change; **Not yet / Send** | A server refusal (a branch with no address, a time after the posting day, a plan already sent) is shown inside the sheet. |
| V4 Creator · the plan arrives | `InvitationCard5` under Active carries `shoot.line` — "Store visit planned for 18 Oct, 11:00 am" | none |
| V5 Creator · what she was sent | `ShootScreen` stage `sent`: solid-ink time card with "About 2 hours", `AddressCard10` with Open in Maps and the contact's call button, Before you go, the posting line; **This time works / Ask for another time** | none |
| V6 Creator · countering | `ShootCounterScreen`: round pill, picker, old → new change line, why, the only-the-time line; **Send** | none |
| V7 Brand · her counter | `ShootThreadScreen` (`side="brand"`): item 6's turn cards, the plan as the opening turn in plain values (Time, Branch, Ask for), **Accept {time} / Suggest another time**, the no-declining hint | none — there is no third button, and no decline route on the server. |
| V8 Creator · on the day | `ShootScreen` stage `agreed` on/after the day: "Today · about 2 hours" on the time card, **I've been to the store** with its hint, quiet **Ask to move this** | Before the day the button is absent and a line says from which day it appears (Q9). |
| V9 Creator · marked, waiting | stage `attended`: the blue box, "Visited" time card, the auto-confirm date and the payment sentence, the step line | none |
| V10 Brand · confirming | `BrandShootScreen` stage `attended`: "Your move…", the time card, the confirm-opens sentence, **Confirm the shoot is done**, quiet **She didn't come — send a new time** | none |
| V11 Brand · done | stage `complete`: the green box, the step line advanced, the record card (Branch, When, She marked it, You confirmed / Confirmed itself), the countdown | none |
| V12 Either side · moving it | `MoveTimeSheet10`: picker, Agreed → new change line, why, the still-before-the-posting-date hint; **Send new time** | Presented as a sheet over the shoot screen rather than a full screen — the same fields. |
| V13 Brand · the time passed | stage `agreed` + `passed`: the amber box, the grey "Passed" time card, the nobody-is-blamed sentence, **Send a new time** | **No "Call {name}" link.** The server never sends her phone number to the brand (gap-check D9: "the brand never sees anything new about her here"), so there is nothing to dial. Raised in the build summary as a question. |
| V14 Brand · Delayed | Delayed chip beside the crumb, the amber box, the Where it stopped card (Stage, Agreed time, Delayed since), the money sentence, the button still works | none |
| V15 Creator · every other state | `ShootScreen`: they moved it (with their reason, from the thread's last turn), confirmed by itself, delayed (with what it means for her money), nothing planned yet | none |

Loading, empty and couldn't-load states on every new screen (`Skeleton`, `EmptyState`, `LoadError`).
No new native module; `NATIVE_RUNTIME` stays `'3'`. The Stage-4 guard test that refuses a native
date picker import in shoot files is kept and now enforces Q8.

Evidence: `Packages/Mobile/src/components/shoot/__tests__/shoot10.test.js` (imports, the Indian
clock without Intl, the gate card per Aim, the step line, the time card, the address card, the
picker's cap and steps, the copy); full mobile suite 575 / 575.

## Walk fix 1 — a branch address may be typed (founder, 18 Sep, after the first walk)

**Before:** the branch edit screen offered only the Google address search, which was not
answering; a branch with no address looked identical to one with an address; the three practice
brands had no address at all (seeded, never registered), so no Store Visit set could be created.

**After:** *Type the address instead* on the edit screen (on by default when the branch has no
address) — a street address of up to 200 characters and an optional 6-digit PIN, saved as the
branch's address with no map pin; the city and state stay what the branch already had (or the
brand's registration city for a new branch). *Search on Google instead* switches back. The
branch card says *No street address yet — tap Edit to add one* in red where there is none.
Server: `address_text` / `pincode` accepted beside `place_id` on create and update.
Tests: `item10-storevisit` (2 new), `item3-branches` (message updated); mobile 575/575.

## Walk fix 2 — the brand's front door and the icons (founder, 20 Sep)

Founder, after walking the store visit: *"i did not find any screen from brand where he needs to
confirm that shoot is done, also no symbol on who ask person with mobile call symbol."* Both real.
Report: `Docs/ITEM10_STOREVISIT_WALK_REPORT.md`.

**Before:** V10 was built and tested but reachable only from one button at the bottom of the
agreement screen — six taps deep, labelled "Plan the visit" at every stage, so nothing ever told
the brand she had visited and it was his move. The set-detail row said "Signed by both on 14 Sep"
for ever. At the agreed stage nothing mentioned the confirm step at all. And item 10 used none of
the seven icons the mockups carry, including the phone on the contact button.

**After:**
- **The agreement button tells the truth** — "Plan the visit" → "Waiting on her answer" →
  "The store visit" → **"Confirm the shoot is done"** (with a tick) → "The visit time passed —
  send a new time". Same button, same place.
- **The set-detail row carries the shoot** — "Plan sent for Sun 18 Oct, 11:00 am — waiting for
  Tanvi to answer", "Tanvi says she visited — confirm the shoot is done" with a **Your move**
  chip, "Shoot done 19 Oct". Tapping a signed visit opens the visit; the ⋯ menu gains "Open the
  store visit". One sentence on a line the row already had — the mirror of V4 on her card.
- **The agreed stage says what is coming**: "Tanvi marks the visit once she has been, and then
  you confirm it. Nothing moves until she does."
- **The Active chip** on V1.
- **All seven icons**: phone on the contact (and on "Call Tanvi"), navigation on Open in Maps,
  padlock on "From the set", tick on the two confirm buttons and the done step dots and the green
  boxes, undo on the three "another time" actions, alert on "Your move" and the amber boxes,
  clock on the blue waiting box, send on the four send buttons, calendar on "Send a new time".
  `PrimaryButton` / `SecondaryButton` take an optional `icon`, `Card7` a `titleIcon`, and a new
  `TextButton` carries the quiet actions — all additive, no existing caller changed.
- **V13's "Call Tanvi" is in** (founder decision, 20 Sep, overriding the gap report's reading of
  §11.1): the server sends the creator's number to the **brand only**, on the **passed** stage
  only. Her side never carries it, and it disappears again the moment she marks the visit.

Deliberately NOT built, because the sequence puts them later: the cross-campaign **Shoots list**
and the **Needs You home surface** (§24, a later item — the four moves and `/brands/me/shoots`
are already wired and waiting), and **notification deep links** (no notification in either app
opens anything; its own job).

Tests: `item10-flow` +2 (her number only when passed and never on her side; the row's line through
all five stages), `shoot10` +3 (the phone and maps symbols, the truthful button labels, the two new
sentences), gate-card assertions moved from text glyphs to the real icons. Mobile 636/636.

## Walk fix 3 — the door to the plan before it is sent (founder, 1 Oct)

Founder, on the brand phone, set "Men" in "Pay day sale" (Pay for Sale, Store Visit, signed by both
that morning): *"now he has to go for shoot plan… it is not showing… link is missing."*

**Before:** walk fix 2 gave the set row a door to the visit only once the plan had been sent. Until
then the row read "Signed by both 1 Oct", had no chip, and opened a menu with View terms and Profile.
The only door to "Plan the visit" was the button on the agreement screen straight after signing, and
the set screen has no way back to a signed agreement — leave that screen and the plan was out of
reach. Confirmed on the production row (read-only): both signed, the visit exists, no plan sent.

**After:** from the moment both have signed, the row reads **"Signed — plan the store visit"**, chips
**Your move**, and opens the visit (where "Plan the visit" is); the ⋯ menu lists "Open the store
visit". The server change alone is enough for the installed app (it already opens the visit on any
row that carries one); the phone change adds the Your move chip at this stage.

Not drawn on a board: one sentence and one chip on a row that already has both, in the words walk
fix 2 established. No rule changes (§11.1 untouched).

Tests: `item10-flow` — the row before the plan is sent now carries `{ stage: 'not_sent', line:
'Signed — plan the store visit' }` (it asserted null; the assertion changed with the behaviour);
`shoot10` +2 (the line, the chip and its press; no chip while waiting on her).
