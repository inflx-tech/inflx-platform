# Stage 4 — workflow

The walk this stage must complete on **two handsets**. Success is the walk, not a green suite.

---

## W0 · Starting state

Production today: **4 shoots** — 1 shipment (`confirmed`, Delhivery), 3 visits (all
`completed`). **No visit carries a slot and the log is empty**, because the practice world was
seeded into its end state rather than driven through the endpoints. Expect to create fresh
ones.

---

## W1 · The shoot has a door

| # | Case | Expected |
|---|---|---|
| W1-1 | Brand: **Campaigns → a campaign → a set → a creator → step 3** | Opens **the shoot**. Today it says *"Stage 4 brings this"* |
| W1-2 | Creator: **Collabs → a collaboration → step 3** | Opens the same shoot, her side |
| W1-3 | A notification about the shoot | Lands on the shoot, not on a contract page |
| W1-4 | Brand: the **Shoots** list | Every shoot across every campaign, **needs-you first** |

---

## W2 · A store visit — settling when

| # | Case | Expected |
|---|---|---|
| W2-1 | Creator opens a visit with no slot | The legal window shown as a **range**, with the reason: post-by minus two days |
| W2-2 | She proposes a day inside the window | Brand is told, and it appears under **needs you** |
| W2-3 | She proposes a day **outside** it | Refused, naming the window |
| W2-4 | Brand accepts | Confirmed on both phones, same date |
| W2-5 | Brand counters instead | She sees the new suggestion, and **how many she has left** |
| W2-6 | Either side counters a third time | **Refused** — two per side |
| W2-7 | The address and contact | Shown, with **Open in Maps** and a phone number |
| W2-8 | **Expected time** | Reads as a guide, never as a deadline |
| W2-9 | Either side asks to **do it remotely instead** | The other confirms, and the shoot changes mode |

**W2-10 · Must not.** Nowhere on this screen is there a shot list, a brief, or anything telling
her what to photograph.

---

## W3 · A shipment — what is in the box

| # | Case | Expected |
|---|---|---|
| W3-1 | Brand opens a shipment shoot | **What you're sending**, empty to start |
| W3-2 | **+ Add from catalogue** | The **same picker** as allocation and offers — grouped, images, prices, search |
| W3-3 | Pick three sarees, set a quantity on one | The list shows name, SKU, price, quantity |
| W3-4 | Try to dispatch with **nothing in the box** | Refused. A parcel with no contents is not a parcel |
| W3-5 | Enter courier + AWB, **Mark dispatched · 3 items** | Both phones show it is on its way |
| W3-6 | Her screen before delivery | Courier, tracking number, expected date |

---

## W4 · She confirms, item by item

| # | Case | Expected |
|---|---|---|
| W4-1 | **Your parcel arrived** | Every item listed, each with its own tick |
| W4-2 | She ticks all three | Confirmed. **The shoot moves to in-progress, NOT completed** (spec §5.1) |
| W4-3 | She ticks two and flags the third missing | **Confirm — 2 of 3 received** |
| W4-4 | The brand's phone | Told immediately, **with the item named** — no chasing |
| W4-5 | Her screen after flagging | Says plainly that a shortfall **never blocks her shoot** |
| W4-6 | **Everything arrived** shortcut | Ticks all, one tap |
| W4-7 | She marks one **damaged** | Recorded and reported the same way as missing (spec §6) |

---

## W5 · The brand answers a shortfall

| # | Case | Expected |
|---|---|---|
| W5-1 | **One item missing** appears in the shoot and in **needs you** | Names her, the item and when |
| W5-2 | **Send the missing saree** | A **second parcel** on the same shoot, with its own courier and AWB |
| W5-3 | **Drop it — she'll shoot the other two** | Her shoot proceeds. On a hand-picked allocation the item leaves what she may sell; on store or category scope it does not (spec §5.3) |
| W5-4 | Either choice | Her shoot is never blocked and she is never asked to chase it |

---

## W6 · Finishing

| # | Case | Expected |
|---|---|---|
| W6-1 | She marks the shoot done | Both phones show step 3 complete and step 4 current |
| W6-2 | A visit, marked done by either side | Same |
| W6-3 | Before she marks it done | **Step 3 stays current**, even with the parcel received |

---

## W7 · The diary that has always existed

| # | Case | Expected |
|---|---|---|
| W7-1 | **See what happened here**, on the shoot | Every action, oldest first: plan created, slot proposed, countered, accepted, dispatched, delivered, confirmed, flagged |
| W7-2 | The same page on her phone | **Word for word the same** |
| W7-3 | An action taken today | Appears. The log has been written all along and never read |

---

## W8 · Regression boundary

* Contract signing is unchanged; the shoot panel leaving the contract screen must not break it
* Stage 3's ladder still reconciles, and step 3 now opens something
* Both mobile suites green; `pnpm qa` certified **no-regression**, never green
* Duplicate-route check clean across every stack in **both** apps
* **The founder walks W1–W7 on both handsets before any deploy go**
