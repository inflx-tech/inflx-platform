# The same audit, in plain language

Companion to `02-audit-step-detail-tracking-products.md`. Same findings, no code names.

Cast: **Asha** (creator, Mumbai) · **Kanchi Silks** (saree brand, Vijayawada) · **Label
Fern** (fashion, Hyderabad) · **Nova Fit** (paying a fee for content).

---

## 1 · "What happened in this step?" — five of the six steps have no memory

### What a negotiation looks like today

Kanchi Silks asks Asha: **15% commission, post by 24 August.**
Asha counters: **22%, post by 2 September.**
Kanchi Silks counters back: **18%, post by 28 August.**
Asha accepts.

Afterwards the app knows: they agreed 18% and 28 August, each side used a counter, and the
dates each message was sent, seen and answered.

The app does **not** know Kanchi Silks ever offered 15%, or that Asha ever asked for 22%.
**Every counter writes over the one before it.**

So a month later, when Asha says *"didn't they originally give me more time?"*, nobody can
answer her. Not Asha, not Kanchi Silks, not your support desk. The conversation happened and
the record of it is gone.

### The same hole in two more places

**Her posts.** "Draped Three Ways" comes back — video too shaky. She re-uploads. It comes
back again — saree cropped out of frame. Only the second reason is kept. She can't see she
was pulled up twice, and you can't count which fault happens most across all creators.

**Her reel.** Nova Fit is allowed two rounds of changes. They ask for one, she resubmits,
they ask for another. Only the second request survives. If she says *"I did exactly what
they asked the first time"*, there is nothing to check.

### The one step that does remember

**The shoot.** Every single action is written down: who proposed the slot, who countered,
who rescheduled, when, and any note attached. If Asha and Kanchi Silks disagree about who
moved the date, the shoot can settle it. Nothing else in the collaboration can.

### What to do

Give every step the same diary the shoot already has. One line per action: **who did it,
what they did, when, and a snapshot of the terms at that moment.**

Do this *before* building "see the detail of this step" screens — otherwise you build six
screens and five of them have nothing to show.

---

## 2 · Tracking after she goes live — one of your three things exists

### 2a · How her Instagram post is doing — **works, but only "right now"**

Her reel had **40,000 views on 5 September** and **95,000 on 20 September**.

The app can show her 95,000. It **cannot** show her it more than doubled — because each time
it checks, the new number **erases** the old one. Nothing keeps yesterday.

So "your reel is growing" is not a sentence this app can currently say. Fixing it means
keeping each reading instead of replacing it — small, but it has to happen before any graph
is promised.

### 2b · How her shop posts are doing — **this does not exist at all**

Asha's "Festive Sarees" post sits in your shop. A shopper scrolls past it, stops, taps it,
taps a saree, adds it to her bag.

The app was **built to record all four of those moments** — and record where it happened,
how far down the feed the post was, and how long the shopper looked. That design is done and
sitting there.

But:

- **No shopper's phone has ever sent one of these.** Not a single one, in production.
- **Even if it had, nothing in the system can read them back out.** They go in and stay in.

So "how are my shop posts performing" has **no answer** today. This is not a missing chart on
top of working data — it is a feature that was designed, half-built, and never connected at
either end.

Two jobs, in order: get the shopping app to actually send these signals, then build the part
that reads them. The chart is third, not first.

### 2c · What she earned on *this* collaboration — **the brand can see it, she can't**

Asha works with Kanchi Silks at 18% and Label Fern at 22%. She has earned **₹14,000** in
total.

The app can tell her ₹14,000. It **cannot** tell her that ₹9,000 came from Kanchi Silks and
₹5,000 from Label Fern.

Kanchi Silks, meanwhile, **can** see exactly what their campaign produced.

> The brand knows what the collaboration earned. The creator does not — in a product where
> her entire pay is commission.

And the information is already there. Every single sale is stamped with which campaign,
which creator and which offer it came from, and there are **six real, stamped sales sitting
in production right now**. Nobody ever wrote the line that adds them up per collaboration.

This is the cheapest genuine win on the whole list.

### 2d · Which products actually sold

Kanchi Silks sent three sarees. Two of them sold.

Which two? The answer is sitting in the sales records and is shown on no screen — not to
Asha, and not to Kanchi Silks per creator.

---

## 3 · Finding brands — the search looks in the wrong place

Asha, in Mumbai, wants to find brands near her.

Today the search works out where a brand is from **one free-typed box on the owner's personal
account**. The results:

- Five brands typed **"Vijayawada"**. One typed **"Vijaywada"**. The app offers Asha these
  as **two different places** to choose between.
- One typed **"Tadepalle"** — a neighbourhood, not a town.
- **Ten brands left it blank**, so they belong nowhere.

Meanwhile every brand has a **proper business address** on file — with the neighbourhood
(Jubilee Hills, Bandra, HITEC City, Indiranagar, Gachibowli), the pincode, and map
coordinates. **The search never looks at it.**

The neighbourhood-level "area" filter you asked for is already in the data. It is being
ignored in favour of a worse field.

### The bigger problem behind it

Of **26 brands, exactly one is open to receiving pitches** — and it is a restaurant with no
town and no address.

So Asha searching for fashion brands in Mumbai finds **nothing** — and would still find
nothing if the filters were perfect. Fixing the filter without settling that first would be
polishing an empty room.

---

## 4 · Seeing products by category — they are labelled, and the labels are never sent

Asha wants to look through Kanchi Silks' 39 sarees the sensible way: silk, cotton, party,
bridal.

**The products are labelled.** Of 92 products in the system, **all 92 carry a category**, and
**80 also sit in the proper category tree**. The organising work is done.

But every screen that shows Asha products sends her **the brand's trade** — "fashion",
"restaurant" — and **never the product's own category**. She gets a flat list of 39 sarees,
newest first, with a name search box.

> It is like a shop that knows exactly which shelf every item came from, and prints a receipt
> saying only "clothing shop". She cannot sort by a label she was never handed.

This happens in **all three places** she looks at products:

1. **Browsing a brand** while deciding whether to pitch them
2. **Seeing what she is allowed to sell** in a campaign
3. **Her full list across every brand** she is contracted with

Same omission, three times. The fix is to include the label that already exists — the
smallest item on this list, and it unblocks all three views at once.

---

## 5 · What each side can do today

| | Kanchi Silks (brand) | Asha (creator) |
|---|---|---|
| See what one campaign earned | **Yes** | **No** |
| See lifetime earnings | Wallet | Yes |
| See Instagram numbers on a post | Yes — current only | Yes — current only |
| See how shop posts perform | **No** | **No** |
| See the history of a step | Shoot only | Shoot only |
| A "what needs me" list | **Yes** — five tabs | **No** — the app counts them and has nowhere to send her |
| Browse products by category | Owns the catalogue | **No** |
| Find brands by area | — | Town only, and the town data is unreliable |

---

## 6 · What I would do, in order

1. **Give every step the diary the shoot already has.** Otherwise "show me what happened in
   this step" is six screens over five blank pages.
2. **Show Asha what each collaboration paid her.** The sales are already stamped; this is
   adding them up. It closes a gap where the brand knows more about her pay than she does.
3. **Send the category label the products already carry.** Smallest change here, and it fixes
   all three product views at once.
4. **Shop-post performance: connect both ends before promising a screen.** The shopping app
   has to start sending the signals, and something has to be able to read them.
5. **Keep each Instagram reading instead of overwriting it**, so growth can be shown.
6. **Brand area search and the empty brand directory** stay behind the decision about whether
   approved brands should be open to pitches by default.

None of this needs a mockup to decide. Once you have picked, I will draw the ones that
survive.
