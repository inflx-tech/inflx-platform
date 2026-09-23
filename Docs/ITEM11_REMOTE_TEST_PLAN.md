# Item 11 — the Remote shoot: test plan

Live since 22 Sep 2026 (migration 191, OTA brand 230 / influencer 217).
Courier in use: **the simulator**. No real courier can be called — see Part E.

Everything below was checked against production on 23 Sep, read-only.

---

## Before you start

| # | What | Blocking? |
|---|---|---|
| 1 | **Top up the Kanchi Silks (practice) wallet — ₹2,000** | **YES** — every wallet is ₹0.00, and booking refuses without money |
| 2 | **Give Kanchi Silks' Main Branch a street address and a pincode** | **YES** — it has neither, and booking refuses a branch that can't be collected from |
| 3 | Sizes on three products | **No** — a product with no sizes is picked as itself. Walk without them; add them later to test the size rule |

**Why ₹2,000.** A same-city parcel prices at **₹60** outbound in a small box, **₹88** in a
medium, **₹172** in a large with 2 kg in it. The return lock is the same plus ₹15. So a full
send-and-return cycle costs **₹135 to ₹359**, and ₹2,000 gives you roughly ten of them. GST is
inside those numbers, never added on top.

**Your logins** — all three take OTP `000000`:

| Who | Number | Where |
|---|---|---|
| Kanchi Silks (practice) | `+91 79000 00190` | brand app |
| Asha M. (practice) | `+91 79000 00110` | influencer app |
| Admin | your own | `admin.inflx.in` → **Test parcels** |

You'll need both phones at once. Asha's profile says **Vijayawada, Andhra Pradesh**, so that is
what her address screen will pre-fill.

---

## What you have to test with

Five Remote collaborations, **all five gate-open**, all Kanchi Silks × Asha. Between them they
cover all three deal types — which is lucky, because the product picker behaves differently for
each.

| Use it for | Collaboration | Deal | Posts | Note |
|---|---|---|---|---|
| **A · the main walk** | `ef874178` | Pay for Content | 30 Sep | No selling scope, so the picker shows your **whole catalogue** — that is correct |
| **B · she can't be collected from** | `d3fde0dc` | Pay for Content | **23 Sep** | Posts today, so it also becomes your Delayed test tomorrow |
| **C · scope, cancel, back-to-store, weight** | `09cf0712` | **Pay for Sale** | **23 Sep** | Has a selling scope — the picker must show only that |
| **D · difference, gift, no-return-left** | `367daa87` | Hybrid | 30 Sep | |
| **E · spare** | `bfea8ef9` | Hybrid | 30 Sep | |

Two of them post **today**. If you leave B and C unfinished overnight they will be flagged
**Delayed** tomorrow morning — which is exactly what you want, so don't rush them.

---

## Part A — the main walk

`ef874178` · about 30 minutes · this is the one that has to work.

| # | Where | Do | Should happen |
|---|---|---|---|
| A1 | Brand app → the set → her row | Open it | The Remote screen. **"She sends her delivery address first… nothing to do yet"**, and **Pick products is greyed out** saying "Opens when her address arrives" |
| A2 | Influencer app → Collabs | Open the same collaboration | **"Send your delivery address"** — and nothing else, because it is the only thing she can do |
| A3 | Her · address | Open it | Name, number, **Vijayawada** and **Andhra Pradesh** already filled in |
| A4 | Her · address | Type a normal pincode (e.g. `520010`), add a landmark note, Send | A confirm sheet listing exactly what she's sending, warning in amber that it can't be changed. Then the screen flips to **"They haven't sent your products yet."** |
| A5 | Her · address | Try to open the address again | Refused — it is locked |
| A6 | Brand app | Reopen | **Her address is now here**: street, pincode, her number, her note. This is the first screen in the whole platform where any of it appears |
| A7 | Brand · Pick products | Open | **Your whole catalogue** (11 products are active and in-store). Pick 2–3, set quantities, leave at least one as **Return** |
| A8 | Brand · Book | Open | Branch radios, box size, packed weight, then one price: shipping, the return lock with its item count, the total, your balance, and the line saying the money locked for her fee is never used for shipping |
| A9 | Brand · Book | Book it | A tracking number starting **`TEST`**, a **Download label** button, and **Cancel booking** |
| A10 | Brand | Tap Download label | A PDF headed **"TEST — NOT A REAL SHIPMENT"** |
| A11 | Brand | Try to change the product list | Refused — the list locks at booking |
| A12 | **Admin → Test parcels** | The parcel is listed. Press **Collected** | Both apps move to "on the way". Her screen shows the five-step line with **Vijayawada** named in the middle |
| A13 | Admin | Press **Out for delivery**, then **Delivered** | Her screen opens the check |
| A14 | Her · check | Mark each line Received / Missing / Damaged | Under the sentence **"Something wrong won't stop your shoot"** |
| A15 | Her | Mark the shoot done | Refused *before* A14. After A14 it works, and **no money moves** |
| A16 | Her | The return card | How many items, by when, and **"You pay nothing"** |
| A17 | Her | Book the return, pick a day | Refused for today; a future day works |
| A18 | Admin | Collected → Delivered on the **return** parcel | Money settles: the lock is released whole, the actual return cost is charged |
| A19 | Brand | Confirm each line came back | With the auto-confirm date stated on screen |

**The single most important thing to check in the whole walk:** at no point does **her** screen
ever show a rupee figure. Not the shipping cost, not the lock, not what came back. If you see
money anywhere on her side, that is an **F** and I need to know immediately.

---

## Part B — the edge cases

Each has its own collaboration so they don't collide. The address is **sent once and locked**,
so B1 must be tried *before* B2 on the same collaboration.

| # | Use | Test | Should happen |
|---|---|---|---|
| B1 | any, before sending | She types a pincode ending **`999`** (e.g. `520999`) | Field turns red with the server's own sentence, **Send disabled**. Nothing is consumed — change it and carry on |
| B2 | `d3fde0dc` | She sends a pincode ending **`998`** (e.g. `520998`) | It sends. **You are warned before you can mark any line Return.** No return lock is taken. Booking a return pickup is refused — she gets **"I've sent it back"** instead, which starts the confirm clock |
| B3 | `09cf0712` | Open Pick products | **Only her selling scope**, not the whole catalogue. This is the Pay for Sale half |
| B4 | `09cf0712` | Book, then **Cancel** before pressing Collected in Admin | Both the shipping and the lock come back. The product list unlocks |
| B5 | `09cf0712` | Cancel *after* Collected | Refused |
| B6 | `09cf0712` | Admin → **Returned to store** | You're charged the fee, told what happened, and offered **Book it again** — exactly once |
| B7 | `09cf0712` | After a back-to-store, she corrects her address | Allowed **once**. A second correction is refused |
| B8 | `09cf0712` | Admin → **weight charge**, enter an amount and a reason | Debited with that reason on your wallet history. **Her side is never blocked by it** |
| B9 | `367daa87` | She marks something Missing or Damaged | You see the flagged items under **"Her shoot carries on"**, with **Report to INFLX** and **It's fine, carry on** |
| B10 | `367daa87` | Press **It's fine, carry on** | Recorded, survives a reload, changes nothing else |
| B11 | `367daa87` | Switch a Return line to **Gift** before booking | Allowed. After booking, refused. Gift → Return is always refused |
| B12 | `367daa87` | Make every line a Gift | The whole return lock is released — there is nothing to come back |
| B13 | any | Press the same Admin button **twice fast** | One event, not two. The second is swallowed |
| B14 | Brand app | Open a **Store Visit** collaboration | Completely unchanged. If anything about Store Visit looks different, that's an **F** |

---

## Part C — the money proof

Do this once, after Part A, on the brand's wallet screen.

1. Every row from the shoot says **courier** something — charge, lock, lock released, refund.
2. **"Reserved"** on the wallet screen has not moved. That figure is money committed to
   creators, and a courier hold must never join it.
3. Asha's earnings, and what's locked for her fee, are **exactly as before**.

Right now, before you start: escrow is **12 rows / ₹34,500**, locked **₹36,260**, released
**₹8,625**, her wallet **₹8,625**. Those four numbers must not change at any point in this
testing, whatever happens to the parcels. If one moves, stop and tell me.

---

## Part D — the things you can't walk in one sitting

These are time-based. There is no "run it now" button, and I won't invent one.

| What | When it fires | How to test it |
|---|---|---|
| **Delayed** | Hourly at **:05**, once the posting date has passed | **Free**: leave `d3fde0dc` and `09cf0712` overnight. They post today, so tomorrow morning both should carry an amber chip naming the Remote stage they're stuck at — and everything must still work |
| **The 48-hour nudge** | Hourly at **:55** | Leave any collaboration two days at a stage where someone owes a move. Reminded **once**, push and in-app only. **No SMS** — if you get an SMS about a shoot, that's an F |
| **The return confirms itself** | Hourly at **:15**, at the stamped due date | The window is **7 days**. Set it to **1** on the admin settings page (Remote return auto-confirm) and it's a next-day test. Changing it later must **not** move an existing due date — that's the point of "stamped" |

If you'd rather not wait, I can run any of those three jobs by hand against production and show
you the result — but that's a **write** to production, so I'll need your go first each time.

---

## Part E — Shiprocket

**Read this part before doing anything in it.**

Today `SHIPPING_PROVIDER` is unset, which means **simulator**, and the Shiprocket adapter is
additionally switched off by `SHIPROCKET_ENABLED`. Nothing you do in Parts A–D can reach a real
courier. That's the safe state, and I'd leave it there until every line below is done.

### E0 · Three things that make this different from the rest of the testing

1. **The switch is global.** `SHIPPING_PROVIDER=shiprocket` sends **every new booking by every
   brand** to the real courier. There is no per-brand or per-collaboration toggle. Today the
   blast radius is small — only Kanchi Silks has Remote collaborations and every other wallet
   is ₹0.00 — but it will not stay that way.
2. **A real test costs real money and moves a real box.** A real courier turns up at a real
   address and collects a real parcel, and your wallet is really debited. There is no way to
   test a live courier without one.
3. **I could not confirm that Shiprocket offers a usable sandbox.** Their public docs describe
   the live API. Ask your account manager directly: *"is there a test mode that returns real
   API responses without dispatching a rider or charging me?"* If the answer is no, your first
   real test is a real parcel and should be a cheap one you send to yourself.

### E1 · Seven questions to ask the account manager first

Three of these change how the software behaves, so they are not optional.

| # | Question | Why it matters |
|---|---|---|
| 1 | Can **one** account hold a pickup location per brand branch, and how many does the plan allow? | Not blocking — we key pickups on (branch, provider), which is right either way |
| 2 | **What exactly signs the webhook** — which header, which algorithm, over the raw body? | **Blocking.** Ours is a placeholder. It **fails closed**: with no secret set it rejects everything, so real updates would silently stop arriving until this is right |
| 3 | Is **return pickup available in Guntur and Vijayawada**? | **Changes behaviour.** If not, "she posts it back herself" stops being an edge case and becomes the normal path in your two main cities |
| 4 | Can a **return be priced at the time you book the outbound**? | **Changes behaviour.** The whole return-lock design assumes yes. If no, we lock the outbound price instead — already built and tested |
| 5 | Is the **label URL** permanent or short-lived? | Either way we cache the PDF ourselves |
| 6 | How is a **weight-difference charge** told to you — a webhook, or only the monthly statement? | If it's the statement, that becomes an admin job rather than something automatic |
| 7 | Can a pickup be booked for a **chosen day**, or only "next working day"? | Her return screen lets her pick a day. If they can't honour it, that picker has to go |

### E2 · Switching on, in this order and no other

Nothing here happens without your explicit go, and I can't do steps 2 and 3 at all — I have no
Render access.

1. **Answer questions 2, 3, 4 above.** If the signature scheme differs from the placeholder, I
   fix the adapter and we re-test before anything is switched on.
2. **You** add the Shiprocket credentials to Render (`SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`,
   `SHIPROCKET_WEBHOOK_SECRET`, and `SHIPROCKET_CHANNEL_ID` if they give you one).
3. **You** set `SHIPROCKET_ENABLED=true` but **leave `SHIPPING_PROVIDER` on simulator.** This
   is the useful in-between state: the adapter can now talk to Shiprocket, but nothing routes
   to it yet.
4. **I** check the connection with read-only calls — log in, fetch serviceability for
   Vijayawada and Guntur. That answers question 3 with their own data rather than their
   salesperson's. No parcel, no charge.
5. **You** register the pickup location and point Shiprocket's webhook at
   `https://inflx-platform.onrender.com/v1/webhooks/shipping/shiprocket`.
6. **You** set `SHIPPING_PROVIDER=shiprocket` — and from that moment it is live for everyone.
7. **First real parcel: send it to yourself.** Cheapest box, lowest declared value, a normal
   pincode, one Return line. Then walk Part A again on it.

### E3 · What the first real parcel must prove

| # | Check | Why |
|---|---|---|
| 1 | The tracking number **does not** start `TEST`, and the label is a **real courier's** | Proves you're actually on Shiprocket and not still simulated |
| 2 | Their status updates arrive **on their own**, with no button pressed in Admin | The webhook and its signature are right — this is question 2 proved rather than promised |
| 3 | The same update arriving twice is **one** event | Real aggregators do resend |
| 4 | The **quoted** price and the **charged** price both appear on the shipment | This is what makes reconciliation possible later |
| 5 | A **return** can be booked and collected | Question 3 and question 7 proved for real |
| 6 | Your wallet shows **courier** rows only — nothing touches Reserved | The money rule holds against a real provider, not just the simulator |

If any of 1–3 fails, set `SHIPPING_PROVIDER` back to `simulator` immediately. Parcels already
in flight are unaffected — every shipment remembers its own provider, so switching back never
redirects a box that's already moving.

---

## How to log what you find

Same as every walk. One line per issue in `Docs/WALKTHROUGH_LEDGER.md`:

- **F (functional)** — broken, wrong data, missing link → fix immediately
- **N (new)** — doesn't exist yet → discuss scope first
- **D (display)** — the data is there, the screen doesn't show it → batched
- **U (UI/UX)** — works but awkward → batched
- **C (cosmetic)** — parked until you ask

Tell me the collaboration (`ef874178`, etc.), the screen, and what you saw. I check it at the
data layer before classifying it — a screen looking wrong and the data being wrong are two
different problems with two different fixes.

**Three things I'd treat as stop-everything:**
1. A rupee figure anywhere on **her** side.
2. Any of the four money numbers in Part C moving.
3. Anything about **Store Visit** behaving differently than it did last week.
