# item10-store-visit — workflow prediction

Mockups: `mockups/item10-store-visit-locked.html` (V1–V15 and the rules table; locked 18 Sep 2026,
re-issued byte-identical with the approval).

| Screen | Predicted | Built as |
|---|---|---|
| V1 Brand · the shoot opens | the gate card (ticks or hourglasses, green or blue), the four-step line, the posting countdown, "Plan the visit" | `BrandAgreementScreen` after both-signed: `GateCard10`, `StepLine10`; button navigates to `BrandShootPlan` |
| V2 Brand · the plan | locked card from the set; who to ask for and their number, required; date and time; how long; what to bring | `brand/BrandShootPlanScreen` + `TextField4`, `TimePicker10` (JS chip picker, max = posting date) |
| V3 Brand · sending it | the confirm listing the full address, the number, the time | `SendPlanSheet10` (`ConfirmSheet`) → `POST …/shoot/plan` |
| V4 Creator · the plan arrives | under Active, one line "Store visit planned for {date}, {time}" | `InvitationCard5` signed branch, from `card.shoot.line` |
| V5 Creator · what she was sent | dark time card, address card with Maps and call, before-you-go, two buttons | `influencer/ShootScreen` + `TimeCard10`, `AddressCard` (from `ShootParts.js`, token pass) |
| V6 Creator · countering | round pill, date and time, old → new, why, the branch/date line | `ShootCounterScreen` (`PitchCounterScreen` shape, one field) |
| V7 Brand · her counter | item 6's turn cards, the plan as turn zero, Accept / Suggest another — no decline | `BrandShootThreadScreen` (`PitchThreadScreen` shape) |
| V8 Creator · on the day | "Today", "I've been to the store", quiet "Ask to move this" | `ShootScreen` stage `agreed` on/after the day → `POST …/shoot/attended` |
| V9 Creator · marked, waiting | the auto-confirm date, "nothing about your payment depends on this" | `ShootScreen` stage `attended` |
| V10 Brand · confirming | one tap, the auto-confirm date, quiet "She didn't come — send a new time" | `BrandShootScreen` stage `attended` → `POST …/shoot/confirm` / `MoveTimeSheet10` |
| V11 Brand · done | both timestamps, the step line advanced, the countdown | `BrandShootScreen` stage `complete` |
| V12 Either side · moving it | new date and time, old → new, why, still capped | `MoveTimeSheet10` → `POST …/shoot/move` |
| V13 Brand · the time passed | amber box, "Passed", one button, a call link | `BrandShootScreen` with `passed:true` |
| V14 Brand · Delayed | Delayed chip, where it stopped, the money sentence, the button still works | `BrandShootScreen` with `delayed` + the eighth tone |
| V15 Creator · every other state | they moved it · confirmed by itself · delayed · nothing planned yet | `ShootScreen` sentences from `copy10` |

Deliberate departures: none from the mockups. The time picker is the pure-JS chip picker rather
than a native one (Q8), which the mockups do not show either way.
