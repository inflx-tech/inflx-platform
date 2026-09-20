# Store visit — the walk, checked against the mockups

Read-only audit, 20 September 2026. Nothing changed, nothing deployed, no production row written.
The mockup file you sent is **byte-identical** to the locked one I built against, so this is a
straight implementation-vs-mockup comparison, not a spec disagreement.

**Your two findings are both real.** One of them is a symptom of something larger.

---

## 1. "No screen from brand where he needs to confirm the shoot is done"

**The screen exists. There is no way to reach it.**

V10 is built — `BrandShootScreen` renders "Your move. {Name} says she visited on {date}", the
time card, the auto-confirm sentence and **Confirm the shoot is done**, with "She didn't come —
send a new time" underneath. It is tested. It is live in OTA 225.

But here is every door into the brand's shoot screens, in the whole app:

| Door | Exists? |
|---|---|
| A button at the bottom of the **agreement screen** | **Yes — the only one** |
| An action on the creator's row in the **set detail** | No — the row offers withdraw, remove, view terms, open the conversation, send/sign/withdraw/download agreement. Nothing for the shoot. |
| A **shoots list** ("what is waiting on me today") | No screen. The server endpoint `/brands/me/shoots` is built, gated and returns the stage and the Delayed flag — nothing calls it. |
| **Needs You** on the brand's home | No. The brand's Home tab is the pending/coming-soon screen. The count is computed server-side and rendered nowhere. |
| Tapping the **push notification** | No. The shoot sends `shoot.attended` to the brand with a deep link (`screen: 'brand_shoot'`), and **nothing in either app reads that field** — a grep for it returns zero hits. The push arrives on the phone and opens the app at wherever it was. |

So to reach the confirm button a brand must go: **Campaigns → the campaign → the set → the
creator's row → Agreement → scroll to the bottom → "Plan the visit"**. Six taps, through a screen
called *Agreement*, behind a button called *Plan the visit* — to confirm a visit that already
happened.

**And the button never changes its words.** It says "Plan the visit" whether the plan is unsent,
the time is agreed, she has marked attended, or the shoot is done. There is no signal anywhere in
the brand's app that she has been to the store and it is his move.

**The second reason you saw no confirm step.** Your live one — Anu Fashion World → Somepalli
Anusha — is at *time agreed*; she has not tapped "I've been to the store" yet, so V10 correctly
has not appeared. But the screen you were on never says that is coming. At the agreed stage the
brand sees the green "Time agreed" box, the time, the branch and the countdown, and nothing at
all about what happens next. The mockup does not show that stage, so I built no sentence for it —
that is my gap, not the mockup's.

---

## 2. "No symbol on who-to-ask person with mobile call symbol"

**Correct — there are no icons anywhere in item 10.** The mockups use seven, and I used none:

| Mockup | Icon | Where | Built |
|---|---|---|---|
| V5, V8 | **phone** | before the contact's name — the call button | ✗ plain text button |
| V5, V8 | navigation arrow | before "Open in Maps" | ✗ |
| V2 | padlock | before "From the set" | ✗ |
| V8, V10 | tick | on "I've been to the store" and "Confirm the shoot is done" | ✗ |
| V7, V8 | undo arrow | on "Suggest another time" and "Ask to move this" | ✗ |
| V10, V7 | alert | on the amber "Your move" line | ✗ |
| V9 | clock | on the blue "waiting" box | ✗ |

The call button *works* — it dials — it just looks like a text button with a name on it, so it
does not read as "call Ravi". The icon set (`react-native-vector-icons`) is in the binary and the
old Stage-4 shoot components used it; items 2–9 happen to use no icons at all, so I carried that
habit into a set of mockups that does use them. That was a mistake on my part, not a constraint.

---

## 3. Everything else, screen by screen

| Mockup | Built as designed? | Gap |
|---|---|---|
| V1 Brand · the shoot opens | **Partly** | The gate card, step line, countdown and button are on the **agreement screen**, and the same content repeats on the shoot screen. The mockup shows one collaboration screen. Also missing: the **Active chip** beside "Pay for Content · Store Visit". |
| V2 Brand · the plan | Yes | Padlock icon missing. Date and time are one picker rather than two fields (a deliberate call I recorded). |
| V3 Brand · send confirm | Yes | — |
| V4 Creator · the plan arrives | Yes | — |
| V5 Creator · what she was sent | Yes | Both icons missing. |
| V6 Creator · countering | Yes | — |
| V7 Brand · her counter | Yes | Undo icon missing. |
| V8 Creator · on the day | Yes | Tick and undo icons missing. |
| V9 Creator · marked, waiting | Yes | Clock icon missing. |
| V10 Brand · confirming | **Built, unreachable** | §1. Tick and alert icons missing. |
| V11 Brand · done | Yes | — |
| V12 Moving it | Yes | A sheet rather than a full screen (recorded). |
| V13 Brand · time passed | **Partly** | No **"Call Tanvi"** link — the server never sends her phone number to the brand, so there is nothing to dial. I flagged this in the build summary and you have not answered it yet. |
| V14 Brand · Delayed | Yes | — |
| V15 Creator · other states | Yes | — |

The creator's side is whole: her card in Active carries the line, tapping it opens the visit, and
every button she needs is on one screen. **The brand's side is the half that is missing its front
door.**

---

## 4. Also blocking your walk

**The three practice brands still have no branch street address** (Kanchi Silks, Label Fern, Nova
Fit). The registration rebuild on 19 September made the street address a required, typed field —
so you can now add it under Profile → Branches → Edit, no Google involved. Until then the Kanchi
Silks Store Visit cannot send a plan, and the two older practice sets have no branch at all.

---

## 5. Checked against the build sequence and rules v1.25

**The rules have not moved under item 10.** v1.25 (19 September) added §2B registration, §2C
location and §14.1, and amended §5B, §7A and §8A. **§11.1 is word-for-word what I built to.** Two
v1.25 lines land on item 10 and both agree with what is built: branches take the four-part typed
address, and "Creators only ever see the city until a Store Visit is planned (§11.1)"; and a
pending account is refused every action including shoots, which the 19 September pending-access
work already enforces generically.

**But my fix list jumped the sequence, and you are right to stop it.** Item 10 is item 10 of 21;
**Needs You is §24 and a later item.** The item 10 prompt asked only that the counts *learn* the
four moves — "Report how each side's counts would learn them" — not that anything display them.
That is what was built: the four moves are derived server-side in the shared step machine, on
both sides, and `/brands/me/shoots` is built, gated and needs-you-ordered. **A Shoots list and a
Needs You home surface are that later item's screens, and proposing them now would be building
§24 inside item 10.** Withdrawn.

What that leaves is the honest question: is the brand's missing door item 10's to fix, or Needs
You's? The line I have drawn — **a door is not a task list**. Item 10 shipped screens; screens
need a way in and a truthful label. It does not need a new surface that lists work across
campaigns; that is exactly what §24 is for.

---

## 6. Conclusion — what to fix now, and what waits

### Now, inside item 10 (its own locked screens V1–V15, its own rules §11.1)

1. **The seven icons**, where the mockups put them — the phone on the contact button first.
2. **The agreement button tells the truth.** V1's button is item 10's. "Plan the visit" becomes
   "Confirm the shoot is done" when she has marked attended, "Waiting for her answer on the time"
   when it is out with her, "Store visit · {date}" once agreed. Same button, same place, honest
   words. This alone makes V10 reachable.
3. **The missing sentence at the agreed stage**: "She marks the visit when she has been, then you
   confirm it." The mockups draw no agreed-stage brand screen, so I drew nothing — that is my gap.
4. **The Active chip** beside "Pay for Content · Store Visit" on V1.
5. **The shoot's stage on the brand's set-detail row** — one sentence on the line that row
   already has, the mirror of V4's line on her Active card, which item 10 already built. Not a new
   screen and not a list.

### Waits for Needs You (§24, a later item)

- The **Shoots list** across campaigns, and the **Needs You surface on the brand's home**.
  Nothing more is needed from item 10 to make them possible: the four moves are already derived
  on both sides and the endpoint already answers. They are screens, and they are that item's.

### Waits for its own job

- **Notification deep links.** No notification in either app opens anything — the deep-link field
  is written by every item and read by nobody. Doing it once, properly, is worth a small piece of
  work of its own; doing it only for shoots would be the wrong shape.

### Needs your word

- **V13's "Call Tanvi".** The mockup gives the brand a call link when a time has passed; the
  server has never sent the creator's number to the brand, and §11.1 says the brand learns nothing
  new about her in the shoot. Mockup and rule disagree, so I am not guessing. Which wins?

Say go and I will build items 1–5 as a walk fix on the item 10 contract, and leave the rest where
the sequence puts them.
