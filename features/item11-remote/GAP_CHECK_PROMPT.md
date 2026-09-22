# INFLX — Item 11: The Remote shoot

## Phase 1: gap identification (backend, database, frontend, admin, courier)

You are working in the INFLX codebase:

- the backend (Node, `backend/src/**`, migrations in `backend/migrations/**`, scheduled jobs in `backend/src/jobs/**`);
- the Brand and Creator phone apps (`Packages/Mobile`);
- the admin website and the brand website, which share the same backend.

Three files come with this prompt:

1. **`INFLX_Master_Business_Rules_Phase_1_v1.26.docx`**: the business rules.
   - **Main section:** **11.2 (Remote, written out today)**.
   - **Related:** 2B (the four-part address, the city list, identity wiring), 7A (selling scope), **7B (Admin numbers and stamping)**, **9 (the Remote return terms, the balance check at signing)**, **10 (the gate)**, 11 and 11.1 (item 10, the shape this item follows), 12 (what comes after), 13 and 20 (unavailable products), 17 (courier charges in the wallet), 24 (Needs You), **25 (the Remote rows)**, **26 (differences and returns that become disputes)**, **27 (Shipment states)**, **28 (the two Remote lock points)**, 31, **32 (what is out)**.
2. **`INFLX_Item11_Remote_Mockups.html`**: the **locked** mockups, screens **R1–R18**, plus the rules table at the end of that page.
3. **This prompt.**

**Order of authority:** rules doc → mockups → this prompt. If two disagree, stop and ask. Never guess.

> **This session is Phase 1 only.** Read and report. Do **not** change code, run migrations or edit data. Do **not** create, book, cancel, confirm or mark anything in **production**. Do **not** call Shiprocket or any courier API — there is no account yet, and nothing in this item may reach a real courier without the founder saying so. Do not move, lock or release money anywhere. Write the gap report (§10), then **stop and wait for approval.**

---

## 0. How to work

- **The repo is the truth.** Items 2–10 were built before this one; earlier reports are guides only. Cite **`file:line`** for every claim.
- **Item 10 has just been built.** Read it as it now stands and reuse it rather than rebuilding any of it:
  - `shootGate` / `assertShootOpen` beside `SIGNED_CONTRACT_SQL` — the one gate;
  - `campaign_sets.shoot_mode` as the source of the mode, and the mode resolver;
  - the production/shoot table(s), `production_event_log`, and how item 10 derives the stage from timestamps;
  - `campaign_influencers.delayed_at` / `delayed_stage` and the Delayed job;
  - the reminder lane at `:55` (48 hours, once per 48 hours, stops at the posting date, skips closed gates);
  - the jobs at `:45` and `:05` (`FOR UPDATE SKIP LOCKED`, compare-and-swap, counts returned, notifications after commit);
  - `productionCopy.js` and the per-item `notify` wrapper;
  - the Needs You rule and both sides' counts;
  - the admin settings row pattern and `platform_settings_audit`;
  - `DangerButton` with `busy`;
  - the retired `flip-to-remote` and `/initialise` mode picker — confirm both are still refused server-side.
- **Item 10's handover to this item:** `addParcelItems` uses an undefined `brandId`, so the brand's add-products call cannot work today. Report it first, with `file:line`.
- **Something already exists here.** There is parcel / shipment code in production (`addParcelItems` is part of it). **Map all of it before proposing anything** — tables, columns, endpoints, screens, jobs — and say for each part whether item 11 keeps, extends or retires it.
- **Couriers are new.** There is no Shiprocket account yet. This item builds INFLX's own **shipping layer** with two providers behind one interface: a **simulator** (fully working, used for all testing now) and a **Shiprocket adapter** (written against Shiprocket's public documentation, switched off). See §4 D9–D11. Report anything in the repo that already talks to a courier, Shiprocket, Delhivery or any logistics API, and any keys or env names that exist.
- **Migrations:** additive only. Find the next free number yourself (item 10 used 187). Dry-run and print counts.
- **Server enforcement:** every rule below is enforced on the server, not only in the app.
- **Phone apps** ship over the air. Flag any new native module. Likely candidates: opening or sharing a **PDF label** (item 7 found no file-viewing module in the binary — check again), and nothing else should be needed. Say plainly what is OTA-safe.
- **Tests:** record the backend baseline before anything, as `baseline_item11.json`, and use item 10's `compare.js`. Item 11 must add no new failures.

### Words: rules doc vs code

| Rules doc / mockups | Code (verify) |
|---|---|
| Creator | `influencer` |
| Collaboration | a `campaign_influencers` row with a signed `contracts` row |
| Shoot Plan | item 10's production/shoot table — report its real name |
| Parcel / shipment | whatever the existing parcel tables are called — report their real names |
| Mode of work | `campaign_sets.shoot_mode = 'shipment'` (Remote) / `'visit'` (Store Visit) |
| Selling scope | item 5's scope on the invitation / contract (whole store, categories, products) |
| Branch | `brand_branches` |
| Posting date | `campaign_sets.go_live_date` |
| Admin numbers | `platform_settings` + `platform_settings_audit` |
| Courier aggregator | Shiprocket, behind INFLX's own shipping layer |
| Delayed collaboration | `campaign_influencers.delayed_at` / `delayed_stage` (item 10) |

---

## 1. Aim of this item

### 1.1 In one sentence

Item 11 lets a creator **send her delivery address**, lets the brand **pick the products, mark each Return or Gift and book one parcel** through INFLX, **tracks it to her door**, lets her **check each item and mark the shoot done**, and brings the **Return items back from her door at the brand's cost** — with a simulated courier standing in until the Shiprocket account is live.

### 1.2 What it delivers

1. **The shipping layer**: one interface, a simulator provider, a switched-off Shiprocket provider, a webhook endpoint, and the Admin **Test parcels** page.
2. **Her address**: the four-part address, number, note and sizes, checked for courier coverage, locked when sent, revealed only to that brand.
3. **The products**: from her selling scope (or the whole catalogue for Pay for Content), variant and quantity, Return or Gift.
4. **Booking**: box, weight, price, wallet debit, the return lock, the label, cancel until collected.
5. **Delivery**: tracking updates, failed attempts, back to the store and one rebooking, one address correction, weight charges.
6. **Checking and shoot done**: item by item, differences recorded and reportable; she marks the shoot done.
7. **Returns**: due date, return pickup from her door, the brand confirms or it confirms itself, overdue, Return to Gift.
8. **Delayed** with the Remote stages, **Needs You**, **notifications**, **one new Admin number**.

### 1.3 Why it matters

It is the first item where INFLX moves physical goods, the first to hold a creator's street address, the first to talk to an outside logistics provider, and the first money movement since item 9 that is not a collaboration payment. Item 16 (customer orders) will reuse the shipping layer built here.

### 1.4 Out of scope

- Store Visit (§11.1) — item 10, done. Report only what item 11 shares with it.
- The content step (§12) — item 12. Shoot done only opens it.
- Disputes (§26) — item 18. Item 11 **records** a report; it builds no dispute handling.
- Customer orders and their delivery — item 16. Build the shipping layer so item 16 can use it; build no order flow.
- Parcels shared between creators or passed from one creator to the next; a second outbound parcel; cash on delivery; same-city riders; the brand choosing a courier; international (§32).
- Going live on Shiprocket. The adapter is written and switched off.

---

## 2. Screen inventory (locked mockups)

| ID | Screen | App |
|---|---|---|
| R1 | The collaboration after signing: gate card, step line, "Waiting for her address", Pick products disabled | Brand |
| R2 | Collabs → Active: the Remote card, "Send your delivery address" | Creator |
| R3 | The address form: name, number, street, pincode, state, city, delivery note, sizes | Creator |
| R4a | Confirm sheet: what she sends, coverage confirmed, "You can't change it after sending" | Creator |
| R4b | A pincode couriers can't reach (blocked), and one where only returns can't be collected (warned) | Creator |
| R5 | Picking products: her locked address, number and sizes; scope; search; variant, quantity, Return/Gift; 3 of 20 | Brand |
| R6 | Booking: branch, box preset, weight, price with GST, return lock, total, balance, "the locked fee is never used" | Brand |
| R6b | Not enough in the wallet: the shortfall and Add money | Brand |
| R7 | Booked: courier, tracking, label download, locked list, Cancel booking until collected | Brand |
| R8 | On the way: tracking steps, what's coming, Return/Gift tags | Creator (and Brand, same steps) |
| R9 | Checking each item: received / missing / damaged, note | Creator |
| R10 | A difference: item states, "Her shoot carries on", Report to INFLX | Brand |
| R11 | Marking the shoot done, with the return card and due date | Creator |
| R12 | Booking the return: items, pickup day, her address, "You pay nothing" | Creator |
| R13 | The return arrived: confirm each item, auto-confirm date, "Something's missing or damaged" | Brand |
| R14 | Done: the parcel record, courier charges, the unused return lock back | Brand |
| R15a | Return → Gift confirm sheet | Brand |
| R15b | Every other state: attempt failed, back to the store + Book it again, return overdue, Delayed, weight difference | Brand |
| R16 | Every other state: not sent yet, back to the store + Correct my address, return overdue, they let you keep it, Delayed | Creator |
| R17 | Admin settings: Remote return window (existing), Remote return auto-confirm (new), Store Visit auto-confirm (existing) | Admin web |
| R18 | Admin Test parcels: provider in use, test pincodes, per-parcel event buttons | Admin web |

The rules table at the foot of the mockups is part of the requirement.

---

## 3. How item 11 links to the rest

Report each row as **ready / not ready**, what is missing, and what item 11 must consume or expose.

| Link | What must be true |
|---|---|
| **Item 10: the gate** | `assertShootOpen` must guard every Remote path listed in §5 and both new jobs. Report where it is and confirm it is mode-agnostic. |
| **Item 10: the mode** | A `shipment` set produces a Remote shoot. Remote endpoints refuse a Store Visit collaboration and item 10's endpoints refuse a Remote one, both with the messages in §7. |
| **Item 10: Delayed, reminders, jobs, copy, Needs You** | Report exactly how each is built so item 11 extends it: new stages for Delayed, new moves for Needs You and the reminder lane, new keys in `productionCopy.js`. |
| **Existing parcel code** | Every table, column, endpoint and screen; `addParcelItems` and its `brandId` defect; what can be kept. |
| **Item 5: selling scope** | Where the scope is stored per collaboration (whole store / categories / products), and a reliable "may she sell this product" test. Pay for Content has no scope — confirm. |
| **Listing engine** | Products, variants, prices, `is_active`, `pushed_to_store`, stock. The picker shows only available products (§13, §20) and moves no stock. Report the availability test and the variant model. |
| **Item 2B: addresses** | The four-part address model, the state and city lists, the creator's profile state and city, the brand's branches and their typed addresses. |
| **Item 9: the wallet** | How a debit from available balance, a lock and a release are written today; the ledger tables; how the balance check at signing refuses and shows a shortfall. Item 11 needs: a courier debit, a return lock, a partial release of that lock, a return-to-store debit, a weight-charge debit, and **an amount owed** when the balance is short. Report whether "owed" exists anywhere. |
| **Item 7: signing** | Nothing to change; confirm the stamped Remote return window on the Agreement and where it lives. |
| **Item 12: content** | What shoot done must write for the content step to open, without building item 12. |
| **Item 16: customer orders** | Anything order-shipping already exists; the shipping layer must not assume a collaboration so item 16 can use it. |
| **Notifications** | The service and the keys that exist; push, in-app, any SMS or WhatsApp. |
| **Admin website** | The settings page, any existing shipment or parcel views, and where the Test parcels page would sit. |
| **Existing production data** | Signed collaborations by mode; how many are Remote; how many have any parcel row; any parcel row without a signed contract or on a Store Visit collaboration; any stored creator street address anywhere. |

---

## 4. Data requirements

For each item report status (**E** exists / **P** partial / **M** missing / **C** conflicts), evidence (`file:line`), and a proposed change.

### D1. The Remote Shoot Plan

One per collaboration, on item 10's table if it fits. It needs, derived from timestamps as item 10 does rather than a new status vocabulary:

| Field | Rule |
|---|---|
| Address sent at | When she sent it. |
| Address corrected at | Her one correction, only after a back-to-store for a wrong address. |
| Shoot done at | When she marked it. No brand confirmation. |
| Delayed | Item 10's flag, with the Remote stages of D8. |

### D2. Her delivery address

| Field | Rule |
|---|---|
| Name | Required. |
| Contact number | Required, a valid Indian mobile, pre-filled with her login number, editable. |
| Street | Required, typed. |
| Pincode | Required, six digits, typed. |
| State | Required, from the §2B list, pre-filled from her profile, editable. Stored as a reference. |
| City | Required, from the §2B list filtered by state, pre-filled from her profile, editable. Stored as a reference. |
| Delivery note | Optional, ≤ 200. |
| Sizes | Optional, ≤ 100. |
| Coverage | The result of the courier coverage check at send: delivers yes/no, return pickup yes/no, and when checked. |
| Snapshot | The address is copied onto the Shoot Plan. Her profile changing later changes nothing (§11.2, §28). |

**Privacy:** only the owning brand sees it, only after it is sent. Report every endpoint that returns creator data to a brand and confirm none would leak this earlier or to another brand. She never sees the brand's street address — report every endpoint that would.

### D3. The parcel

| Field | Rule |
|---|---|
| Collaboration | One outbound parcel per collaboration. Propose the constraint. A rebooking after back-to-store reuses the same parcel record or a clearly linked one — recommend. |
| Direction | Outbound / return. The return is its own shipment record. |
| Pickup branch | The brand's main branch by default, any of its branches. |
| Box | Preset (small 25×20×5, medium 35×25×10, large 45×35×15 cm) or typed dimensions. |
| Weight | Required, kg, packed. |
| Provider | `simulator` or `shiprocket`, recorded on every shipment and never changed. |
| Courier, tracking number, label | From the provider. |
| Price | GST included, as quoted and as charged. |
| Timestamps | Booked, cancelled, collected, out for delivery, each failed attempt, delivered, returned to store. |
| Rebooked | Once, after back-to-store. |

### D4. The lines

| Field | Rule |
|---|---|
| Product and variant | From her selling scope (Pay for Sale, Hybrid) or the whole published catalogue (Pay for Content). Available only. |
| Quantity | 1–5 per variant. At most 20 lines per parcel. At least 1. |
| Return or Gift | Per line. Return → Gift allowed until the return pickup is booked; Gift → Return never once booked. Record every change with who and when. |
| Her check | Received / missing / damaged, note ≤ 300, when. |
| Returned | Whether it went back on the return. |
| Brand's return check | Received / missing / damaged, when, or auto-confirmed. |
| Reported | Brand's report to INFLX (a difference or a return problem), with when and who. Recorded for item 18. |

The list locks at booking (§28) and opens again only on a cancel before collection.

### D5. The money

| Movement | Rule |
|---|---|
| Outbound price | Debited from the brand's available balance at booking. Refused if short, shortfall shown. |
| Return lock | When any line is Return, the provider's quoted return price is locked from available balance at booking. Refused if short (one total). |
| Cancel before collection | Both come back. |
| Return settled | At return pickup, the actual price comes out of the lock; the rest is released to the brand. |
| No Return left | Every Return turned Gift, or every Return item marked missing by her: the whole lock is released. |
| Return-to-store charge | Debited from the brand. |
| Weight charge | Debited from the brand with the courier's reason. If short, recorded as **owed** and taken from the brand's next money in. Never blocks the creator. |
| Never | Charged to the creator. Taken from the collaboration's locked fee. |

Report how each would be written in item 9's ledger and how the brand's wallet history would show them as courier charges. Prove none can touch `contracts.locked_amount`.

### D6. Returns

| Rule | Detail |
|---|---|
| Due date | Stamped Remote return window (Agreement) days after the later of the posting date and shoot done. Judged in India time. |
| Booking | From shoot done. She picks a day from tomorrow. All Return lines she marked received go. |
| Auto-confirm | New Admin number, 7 days, **stamped on the return when it is delivered to the branch**. A job confirms it and records that it was automatic, unless the brand has reported a line. |
| Overdue | Past the due date with no pickup booked. Derived, not stored, unless you show why it must be. Shown to both, reminders to her, the brand may report. Nothing moves. |

### D7. Needs You

Creator: send your address; check what arrived; mark the shoot done; book the return. Brand: pick products and book; confirm the return. From one rule, both sides, the way item 10 did it. Reminded at 48 hours through item 10's lane.

### D8. Delayed

Item 10's job and flag. Remote stages: `address_not_sent`, `not_booked`, `in_transit`, `not_checked`, `shoot_not_marked`. The return lane never delays anything.

### D9. The shipping layer

One interface, used by item 11 now and item 16 later, that knows nothing about collaborations:

- `checkCoverage(pickupPincode, deliveryPincode)` → delivers, return pickup;
- `quote(...)` → price with GST, for outbound and return;
- `registerPickup(branch)` → the provider's pickup location id;
- `book(shipment)` → courier, tracking number, label;
- `cancel(shipment)`;
- `bookReturn(shipment)`;
- `label(shipment)` → a PDF;
- an inbound **webhook** that turns provider updates into INFLX events: collected, out for delivery, attempt failed (with reason), delivered, returned to store, weight charge (with amount and reason).

Events must be **idempotent** (the same update twice is one event), **order-tolerant** (a late "out for delivery" after "delivered" changes nothing), authenticated, and logged raw. Propose where the layer lives and how a provider is chosen.

### D10. The simulator

- Coverage: pincodes ending **999** do not deliver; ending **998** deliver with no return pickup; everything else both.
- Quote: a believable price from weight and distance between the §2C city coordinates.
- Book: a tracking number starting `TEST`, a label PDF reading **"TEST — NOT A REAL SHIPMENT"**.
- Events come only from the Admin **Test parcels** page (R18), and are delivered **through the same webhook handler** as the real provider, so notifications, Needs You, the wallet and Delayed run exactly as they will in production.
- A simulated shipment can never be sent to a real provider, and a real one never to the simulator.
- The Test parcels page: Admin only, every press logged with who and when.

### D11. The Shiprocket adapter

Written from Shiprocket's public API documentation (auth token, add pickup location, serviceability and rates, create order, assign AWB, generate pickup, label, cancel, return order, tracking webhooks). **Switched off.** No call leaves the server. Report the environment variables it will need and how the founder switches providers. Say what cannot be known until the account exists — for example whether one INFLX account may ship for many brands, the webhook signature format, return-pickup coverage in Guntur and Vijayawada — and list these for the founder.

### D12. The Admin number

`remote_return_autoconfirm_days`, default 7, on item 10's data-driven settings page, audited, stamped at delivery to the branch. The existing Remote return window is unchanged.

### D13. Notifications

Needed, through item 10's wrapper and `productionCopy.js`:

| Key | To |
|---|---|
| address sent | Brand |
| parcel booked | Creator |
| collected | Both |
| out for delivery | Creator |
| delivery attempt failed | Both |
| delivered | Both |
| back to the store | Both |
| weight charge | Brand |
| difference reported | Brand |
| shoot done | Brand |
| Return made a Gift | Creator |
| return booked | Brand |
| return collected | Both |
| return delivered | Both |
| return confirmed / confirmed itself | Creator |
| return overdue | Both |
| delayed | Both (once) |

Report the service and the keys that exist.

### D14. Legacy data

Existing Remote collaborations and parcel rows: what each would show on the new screens, and whether any backfill is needed. **Prefer none.**

---

## 5. API requirements

Follow existing naming. Propose request and response shapes and error codes. Say for each whether it exists, needs extending, or is new. **Every one** behind `assertShootOpen` and the mode check; brand endpoints for the owning brand, creator endpoints for that creator, everything else 404.

| ID | Endpoint | Screens |
|---|---|---|
| F1 | **The Remote shoot state**, both sides: gate, address (brand only once sent), parcel, lines, tracking, return, due date, what this side can do now. | R1, R2, R7, R8, R11, R14–R16 |
| F2 | **Coverage check** for a pincode, before sending. | R3, R4b |
| F3 | **Send the address** (one call, confirm sheet is the review). | R4a |
| F4 | **Correct the address**, once, only after a back-to-store for a wrong address. | R16 |
| F5 | **Product picker**: her scope or the catalogue, available only, with variants. | R5 |
| F6 | **Save the lines** before booking (or send them with F8 — recommend). | R5 |
| F7 | **Quote**: box, weight, branch → outbound price, return lock, total, balance, shortfall. | R6, R6b |
| F8 | **Book the parcel**: validates everything, debits, locks, locks the list, calls the provider. | R6 |
| F9 | **Label** (PDF). | R7 |
| F10 | **Cancel** before collection. | R7 |
| F11 | **Book it again** after back-to-store, once. | R15b |
| F12 | **Her check**, item by item. | R9 |
| F13 | **Report to INFLX** (a difference or a return problem) — records only. | R10, R13 |
| F14 | **Shoot done.** | R11 |
| F15 | **Return → Gift.** | R15a |
| F16 | **Book the return pickup.** | R12 |
| F17 | **Brand confirms the return**, item by item. | R13 |
| F18 | **Provider webhook.** | — |
| F19 | **Admin: Test parcels** list and event injection (simulator only). | R18 |
| F20 | **Admin: the new number.** | R17 |
| J1 | **Job: return auto-confirm** at the stamped due, idempotent, logged. | R13, R16 |
| J2 | **Job lanes extended**: Delayed with Remote stages; the 48-hour reminder lane with the Remote moves and the overdue return. | R15b, R16 |

Every write is compare-and-swap; two taps or two devices produce one of each.

---

## 6. Business rules and screen behaviour (exact)

### 6.1 Opening (R1)

- Header her name; campaign and set in small caps; "{Aim} · Remote" with an Active chip.
- The gate card exactly as item 10 (Pay for Sale shows only the signature line).
- Step line: Agreement signed · Products · Content · Live and paid.
- Blue box: "{Name} sends her delivery address first. You pick the products once she has — nothing to do yet."
- Posting countdown. **Pick products** disabled, with "Opens when her address arrives."

### 6.2 Her address (R2–R4b)

- Active card: "Send your delivery address", Your move.
- Form fields and hints as R3: "Your login number. Change it if the courier should call someone else."; "From your profile. Change it if you want it sent somewhere else."; "So {Brand} send the right sizes."; counters 200 and 100.
- **Review and send** → sheet listing name, number, address, note, sizes; green "Couriers deliver and collect returns at {pincode}."; amber "This is where they ship your products. You can't change it after sending."; **Not yet** / **Send**.
- Not deliverable: the field in error and the message in §7; the button disabled.
- No return pickup: amber "Couriers deliver to {pincode} but can't collect returns from it. You can still send it — {Brand} will be told before they choose what to send back."

### 6.3 Products (R5)

- Her address card with a Locked chip, number, note, and "Her sizes".
- "Her selling scope · {Whole store / N categories / N products}" (Pay for Content: "Your catalogue"); "{n} of 20".
- Each line: image, name, variant, quantity stepper 1–5, Return/Gift switch.
- Hint: "Return items come back after the shoot at your cost. Gifts are hers to keep. At most 5 of one size."
- When her pincode has no return pickup: the warning in §7 before any line can be set to Return.

### 6.4 Booking (R6, R6b, R7)

- Collected from: branch radios, main first.
- Box presets and Other; packed weight with the hint "Weigh it packed. If the courier finds it heavier, the difference is charged to you later."
- Money card: "Shipping to {name}", "Return pickup, locked for {n} items", "From your wallet"; "GST included. Courier chosen by INFLX. Anything the return doesn't use comes back to you."
- "Available in your wallet"; "The ₹{fee} locked for {name}'s fee is never used for shipping."
- **Book and pay ₹{n}**. Short: red "Add ₹{n} to book this parcel / You have ₹{n} available", **Add money**, "Back to products".
- Booked: green "Booked on {date}. The courier collects from {branch} {when}."; courier, tracking, box; **Download label** with "Print it and stick it on the parcel before the courier arrives."; the locked list; **Cancel booking** with "Only until the courier collects. You get the ₹{n} back and can change the products."

### 6.5 Delivery and checking (R8–R11)

- Dark status card while live (out for delivery, with time and tracking); step line Booked · Collected · In {city} · Out for delivery · Delivered.
- "What's coming" with Return/Gift tags; "Gifts are yours to keep. Return items go back after your shoot — {Brand} pay for that too."
- Check: per line Received / Missing / Damaged, a note when not received; "Something wrong won't stop your shoot. {Brand} are told, and you carry on." **Save**.
- Brand: amber "{Name} reported a difference on {date}."; line states; "Her shoot carries on. If you want INFLX to look at it, report it — it becomes a dispute and stays on record."; **Report to INFLX**, "It's fine, carry on".
- Shoot done: green "Checked on {date}…"; step line; the return card "{n} items to send back · Back by {date}"; **I've finished the shoot** with "Tap this once you've shot. It opens your content step. {Brand} don't need to confirm it."

### 6.6 The return (R12–R14)

- Send back: the Return lines, pickup day chips from tomorrow, her locked address, green "You pay nothing. {Brand} cover the return.", **Book the pickup**.
- Brand: amber "Your move. The return reached {branch} on {date}."; per line Received / Missing / Damaged; "If you do nothing, this confirms itself on {date}."; **Confirm the return**, "Something's missing or damaged".
- Done: green "Return confirmed on {date}…"; record card (delivered, she checked it, shoot done, return collected, you confirmed); courier charges (shipping, return pickup, back to your wallet).

### 6.7 Everything else (R15a–R16)

Copy exactly as the mockups: Return → Gift sheet; attempt failed; back to the store with **Book it again** / **Correct my address**; return overdue; they let you keep it; Delayed ("Nothing moved: ₹{n} is still locked and {name} keeps her ₹{n}"); weight difference ("{Courier} charged ₹{n} more: weighed {x} kg, entered {y} kg. Taken from your wallet — or owed from your next money in if it's short.").

---

## 7. Validation and messages (server and app, identical text)

| Field / action | Rule | Message |
|---|---|---|
| Unsigned | Server | This collaboration isn't signed by both of you yet. |
| Unfunded (PfC / Hybrid) | Server | The money for this collaboration isn't locked yet. |
| Store Visit collaboration on a Remote action | Server | This is a Store Visit collaboration. {Brand} send a time and the store address. |
| Name | Required | Enter your name. |
| Contact number | Required, Indian mobile | Enter a 10-digit mobile number. |
| Street | Required | Enter your street and house. |
| Pincode | Six digits | Enter a 6-digit pincode. |
| State / city | Required, from the list | Choose your state. / Choose your nearest major city. |
| Delivery note | ≤ 200 | Keep it under 200 characters. |
| Sizes | ≤ 100 | Keep it under 100 characters. |
| Not deliverable | Server | Couriers don't deliver to {pincode} yet. Try an address at a pincode nearby, such as where you work or a friend's. |
| Sending twice | Server | Your address is already with {Brand}. |
| Editing a sent address | Server | Your address is locked for this shoot. |
| Correcting when not allowed | Server | You can correct your address only if the courier brings the parcel back. |
| Correcting twice | Server | You've already corrected your address once. |
| Brand picks before the address | Server | {Name} hasn't sent her address yet. |
| Product outside her scope | Server | {Name} can't sell this product under your agreement. |
| Unavailable product | Server | This product isn't available right now. |
| No lines | Server | Add at least one product. |
| Over 20 lines | Server | A parcel can hold up to 20 products. |
| Over 5 of a variant | Server | At most 5 of one size. |
| Return on a no-return pincode | Warning, not a block | Couriers can't collect returns from {pincode}. If you mark this Return, you and {name} arrange the return yourselves. (Wording follows the answer to §11 Q1.) |
| Box | Required | Choose a box size. |
| Weight | Required, > 0 | Enter the packed weight. |
| Short balance | Server | Add ₹{n} to book this parcel. |
| Booking twice | Server | This parcel is already booked. |
| Changing lines after booking | Server | The products are locked once the parcel is booked. |
| Cancel after collection | Server | The courier has already collected this parcel. |
| Book again when not allowed | Server | You can book again only if the courier brings the parcel back. |
| Book again twice | Server | This parcel has already been booked again once. |
| Checking before delivery | Server | The parcel hasn't been delivered yet. |
| Checking twice | Server | This is already checked. |
| Check note | ≤ 300 | Keep it under 300 characters. |
| Shoot done before checking | Server | Check what arrived first. |
| Shoot done twice | Server | This is already marked. |
| Return before shoot done | Server | Mark the shoot done first. |
| Return with no Return lines | Server | Nothing to send back — everything is a gift. |
| Pickup day in the past or today | Server | Choose a pickup day from tomorrow. |
| Return booked twice | Server | The return pickup is already booked. |
| Return → Gift after pickup booked | Server | The return pickup is already booked. |
| Gift → Return after booking | Server | A gift can't be turned back into a return. |
| Brand confirms before delivery | Server | The return hasn't reached you yet. |
| Confirming twice | Server | This is already confirmed. |
| Reporting twice | Server | You've already reported this. |
| Test parcels on a real provider | Server | Test parcels only work with the simulator. |

---

## 8. Look and feel

Item 2's theme, as items 3–10 use it, and the mockups' additions:

- White, `#F6F6F3` surfaces, `#E5E4DE` borders, ink `#1A1A17` / `#5B5A53` / `#77766E`; yellow `#FFC700` for the single main button.
- Gate card and step line exactly as item 10.
- **Return** tag in the waiting-blue family, **Gift** in the done-violet family.
- The live tracking card is solid ink with white text, as item 10's time card.
- Missing/damaged in the red family on the check control only; Delayed and overdue in the yourMove-amber family.
- Tracking numbers in the mono font.
- Plus Jakarta Sans; dates "15 Oct", times "4:10 pm", money "₹12,450".

---

## 9. Phase 1 checklist

### 9.1 Database
- Every column of the existing shoot, parcel and shipment tables, with writer and reader.
- Everything in §4 (D1–D14) mapped to a column or named as missing.
- The wallet ledger as item 9 left it, and whether "owed" exists.
- Indexes for both sides' lists, the webhook lookup by provider and tracking number, and the job lanes.
- Production counts from §3's last row.

### 9.2 Backend
- Every endpoint in §5, with what exists, its shape, callers and access checks.
- Every path into a Remote shoot, and what each checks now.
- The shipping layer proposal: interface, providers, webhook, where the provider is chosen.
- The jobs runner and where J1 and J2 fit.
- The notification keys that exist.

### 9.3 Phone apps
- **Brand:** the collaboration screen as item 10 left it; where the Remote flow attaches.
- **Creator:** the Active tab and item 10's shoot screens.
- Reusable components: gate card, step line, time card, confirm sheets, `DangerButton`, chips, state boxes, fields, skeletons, empty and error states.
- New: the address form with state/city pickers (reuse item 2B's), the product picker with variant and quantity, the Return/Gift switch, the box presets, the money card, the tracking step line, the three-way check control.
- **Check before assuming:** can the app download, open or share a PDF label? Say plainly whether it is OTA-safe; if not, propose the fallback (for example, opening the label URL in the phone's browser).

### 9.4 Websites and admin
- The settings page and the new row; where the Test parcels page goes; anything on the brand website that touches parcels today — recommend retiring it server-side, as item 10 did with the visit panel.

### 9.5 Tests
- Baseline pass and fail counts into `baseline_item11.json`; existing tests touching production, parcels, wallet and jobs.

---

## 10. Phase 1 output

Write **`Docs/ITEM11_REMOTE_GAP_REPORT.md`**:

1. **Summary:** area · status · one-line gap.
2. **Requirement table:** ID · requirement · status · evidence (`file:line`) · proposed change · risk.
3. **What already exists, in detail:** the parcel code, `addParcelItems` and its defect, and keep / extend / retire for each part.
4. **The gate and the mode on every Remote path**, in a route table as item 10 did.
5. **Link readiness (§3),** row by row.
6. **The shipping layer:** interface, simulator, Shiprocket adapter, webhook, provider switch, and the list of things only the live account can answer.
7. **The money:** every movement in D5 as ledger rows, and the "owed" proposal.
8. **Proposed migrations** (additive), with dry-run checks.
9. **Proposed endpoints** with shapes, error codes and affected callers.
10. **The job lanes:** J1 and J2, and how each is proved idempotent.
11. **Frontend plan** per screen, components reused and new, and the PDF answer.
12. **What item 16 will reuse.**
13. **Test baseline** and the tests you will add.
14. **Questions for the founder,** each with a recommendation, including every assumption in §11.

Then **stop and wait for approval.**

---

## 11. Assumptions to confirm in your questions

1. **The gate and the mode are item 10's,** unchanged, on every Remote path.
2. **She starts it;** the brand has nothing to do until her address arrives.
3. **Her address is the four-part §2B address,** state and city pre-filled and editable, plus number, note and sizes; it locks when sent, with one correction after a back-to-store for a wrong address.
4. **Only the owning brand sees it,** only after it is sent; she never sees the brand's street address.
5. **Products come from her selling scope,** or the whole published catalogue for Pay for Content; available only; 1–20 lines, 1–5 per variant; each Return or Gift.
6. **One outbound parcel per collaboration,** rebooked at most once after a back-to-store.
7. **Every rupee of shipping is the brand's:** outbound at booking, the return locked at booking and settled at pickup, back-to-store and weight charges debited, owed when short. Never the creator's, never the locked fee.
8. **A difference never stops her;** reports are recorded for item 18.
9. **She marks the shoot done;** the brand does not confirm it.
10. **Returns are due from the later of the posting date and shoot done,** collected from her door, confirmed by the brand or by itself after the stamped Admin number.
11. **Return → Gift until the pickup is booked; never Gift → Return.**
12. **Delayed is item 10's flag** with the Remote stages; the return never delays anything.
13. **A simulator is the only live provider in item 11;** the Shiprocket adapter is written and switched off.

**One question the rules leave open — recommend an answer:**

- **Q1. Return items to a pincode with no return pickup.** §11.2 warns the brand before it marks a line Return but does not say what happens to the return. The founder's likely preference: the brand is warned; if it keeps Return lines, the return is sorted out between them outside INFLX, no pickup is booked and no return lock is taken, and the brand still confirms receipt in the app so the due date, overdue and auto-confirm work as normal. Say whether the code supports that cleanly or what would be simpler.

Report also, as questions: the declared value the courier will need on the label and whether any invoice must travel with sample goods; whether courier charges need a GST invoice from INFLX to the brand; and how INFLX's own balance with the aggregator should be reconciled against brand debits once the real account exists.

---

## 12. After approval (not in Phase 1)

- **Phase 2a:** the `addParcelItems` fix, the gate and mode on every Remote path, the retirements.
- **Phase 2b:** the shipping layer, the simulator, the webhook, the Test parcels page — tested on its own before any feature uses it.
- **Phase 2c:** the address, the products, booking and money, delivery, checking, shoot done, returns, the jobs, the Admin number, notifications, Needs You.
- **Phase 3:** the Brand screens R1, R5–R7, R10, R13–R15b; the Creator screens R2–R4b, R8, R9, R11, R12, R16; Admin R17, R18.
- **Phase 4:** tests.

### 12.1 Final functionality: all must pass

**Gate and mode**
1. An unsigned collaboration, and a signed-but-unfunded Pay for Content or Hybrid one, reach no Remote path — proved by a loop over the route table.
2. Pay for Sale opens on signatures alone.
3. A Store Visit collaboration is refused by every Remote endpoint, and a Remote one by every item 10 endpoint, each with its message.

**Her address**
4. State and city arrive pre-filled from her profile and can be changed; name and number arrive pre-filled.
5. A pincode ending 999 cannot be sent, with the message; one ending 998 can, and the brand is warned before setting any line to Return.
6. Sending locks the address; a second send and any edit are refused; changing her profile changes nothing on the Shoot Plan.
7. The brand sees nothing of her address, number or sizes before she sends them; another brand never does; she never sees the brand's street address.
8. After a back-to-store for a wrong address she may correct it once; a second correction and a correction at any other time are refused.

**Products and booking**
9. The picker shows only her scope for Pay for Sale and Hybrid and the whole published catalogue for Pay for Content, available products only; a product outside the scope is refused by the API.
10. 0 lines, 21 lines and 6 of a variant are refused.
11. The quote shows GST-included prices and the return lock only when a line is Return.
12. A short balance refuses booking with the exact shortfall; after adding money the same booking succeeds.
13. Booking debits the outbound price, locks the return price, locks the list and returns a label; changing lines afterwards is refused.
14. Cancel before collection returns both amounts and reopens the list; cancel after collection is refused.
15. Two taps or two devices produce one booking and one debit.

**Delivery**
16. Every simulated event (collected, out for delivery, attempt failed, delivered, back to store, weight charge) arrives through the same webhook handler as the real provider and produces the right state, notification and Needs You change.
17. The same event twice is one event; an event arriving out of order changes nothing it shouldn't.
18. Back to the store charges the return-to-store fee and allows exactly one rebooking.
19. A weight charge is debited with its reason; when the balance is short it is recorded as owed and taken from the next money in; the creator is never blocked.

**Checking and shoot done**
20. Checking before delivery is refused; each line takes one check; a difference notifies the brand and appears to Admin.
21. A report to INFLX is recorded once and nothing else happens.
22. Shoot done before checking is refused; after it, the content step opens and no money moves.

**Returns**
23. The due date is the stamped window after the later of the posting date and shoot done, in India time.
24. Booking the return before shoot done, with no Return lines, or for today or the past is refused.
25. The return settles from the lock and the remainder is released; the brand's wallet history shows every courier charge.
26. Return → Gift works until the pickup is booked and is refused after; Gift → Return is refused after booking; no Return left releases the whole lock.
27. The brand confirms each line; the job confirms by itself at the stamped due unless a line was reported; changing the Admin number afterwards moves no stamped due.
28. Past the due with no pickup booked, both sides see it overdue and she is reminded; nothing moves.

**Money**
29. Nothing in the whole of item 11 is charged to the creator or taken from `contracts.locked_amount` — proved by balances and ledger before and after a complete shoot with a return.

**Delayed, Needs You, reminders**
30. Past the posting date the collaboration is flagged Delayed with the correct Remote stage, both told once, and everything stays usable.
31. Needs You shows the right move to the right side at each of the six points.
32. Each unanswered move is reminded once at 48 hours and not again within 48 hours; closed gates are skipped.

**Simulator and provider**
33. Every shipment records its provider; a simulated shipment can never reach the Shiprocket adapter and vice versa.
34. The Shiprocket adapter makes no network call while switched off, proved by a test.
35. The Test parcels page is Admin only, and every press is logged with who and when.
36. Simulator labels read "TEST — NOT A REAL SHIPMENT" and tracking numbers start `TEST`.

**Access and states**
37. Another brand's or another creator's shoot, parcel, return or action returns 404.
38. Loading, empty and couldn't-load states appear on every Remote screen, both sides.
39. `DangerButton` and every new confirm sheet honour `busy`.
40. `addParcelItems` works for the owning brand and is refused for any other.
41. Backend tests show no new failures against `baseline_item11.json`.

### 12.2 Final deliverable

A short summary of what changed, the gate and mode on every Remote path first, the shipping layer and what only the live account can answer, the test results, the result of every check 1–41, what item 16 can reuse, and anything left open.

Nothing is created, booked, cancelled, confirmed or marked in production, no call is made to any real courier, and no money moves, without asking the founder first.
