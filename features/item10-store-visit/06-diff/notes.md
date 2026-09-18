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
