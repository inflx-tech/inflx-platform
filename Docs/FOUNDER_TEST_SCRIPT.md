# Founder functional test script — Parts 1 to 6

You run these. I wrote them so you never have to guess what to click or what counts as
correct. Work top to bottom — each session builds the data the next one needs.

**How to use it:** do the action, compare against *"You should see"*, tick or cross. When
something crosses, stop and tell me the case ID — I can read the database underneath and
tell you whether the screen is lying or the data is genuinely wrong.

**Time:** about 3 hours in total, split into 8 sessions you can do separately.

---

## Session 0 — Setup (5 minutes)

### Logging in

**Every account signs in with OTP `000000`.** Production has OTP mocking switched on, so any
registered phone number works. That is how you can be the brand, the creator and the shopper
in one sitting.

> ⚠️ **This is also a live security hole** — anyone who knows a registered phone number can
> sign in as that person, including a brand with a wallet. It is what makes today's testing
> possible, and it must not stay this way. Flagged separately; do not fix it before you
> finish testing or you will lock yourself out of these accounts.

### Accounts to use

| Role | Use this | Notes |
|---|---|---|
| **Brand** (main) | `+919000000046` — Charvitha Fashions | 39 products, all published. Best brand to test with. |
| **Brand** (second) | `+919000100003` — Urban Stitch | 8 products. For a second opinion. |
| **Creator** (fresh) | `+919000000001` — priyacooks | No collaborations yet — ideal for the handshake. |
| **Creator** (fresh) | `+919000000002` — arunfashion | Spare, for the second handshake. |
| **Creator** (busy) | `+919000200004` — ftw_sana | Has 3 live collaborations — use for "what an existing creator sees". |

- **Web:** `inflx.in/login`
- **Phone:** the installed app. **Force-close and reopen it first** so it pulls the latest
  update (brand v168, creator v165).

### Two things that will look broken but are not

1. **Every brand wallet is ₹0.00.** So a *paid* campaign will refuse to publish for
   insufficient funds. That refusal is correct behaviour — case **S2-7** tests exactly that.
   Only top up if you want to go further.
2. **Only one brand accepts creator proposals** (`Aveen food paradise`), and **no brand has a
   city recorded.** So in Session 5 the industry filter will show one option and the city
   filter will show nothing. The feature works; the data is empty. Case **S5-9** covers it.

---

## Session 1 — Offers and listing · Part 1 · web, 15 min

Sign in as **Charvitha Fashions** (`+919000000046`).

| # | Do this | You should see | ✓/✗ |
|---|---|---|---|
| S1-1 | Products → pick any product → **unpublish** it (turn off push-to-store) | It saves | |
| S1-2 | Offers → create a discount offer → try to include that unpublished product | **Refused**, telling you the product isn't in your store | |
| S1-3 | Publish the product again → retry the same offer | **Accepted** | |
| S1-4 | Create an offer, publish it, then unpublish one of its products | A **warning**, and it lets you continue | |
| S1-5 | Campaigns → new → set a **start date of today** | **Accepted.** (It used to demand 7 days' notice) | |

**What Part 1 also fixed that you'll confirm later:** commission is never shown to a shopper
as a discount (Session 7, case S7-4).

---

## Session 2 — Campaign creation · Part 5 · web, 25 min

Still signed in as **Charvitha Fashions**. This is the session that proves the budget and
end-date questions are gone.

| # | Do this | You should see | ✓/✗ |
|---|---|---|---|
| S2-1 | Campaigns → **New campaign**. Look at step 1 only | **No budget field. No end-date field.** Just name, start date, and the negotiation toggle | |
| S2-2 | Name it *"TEST sales — ongoing"*, start today, continue | Moves on without asking for anything else | |
| S2-3 | Add one set → aim **pay per sale** → set a posting window (say today → +14 days) | Accepted; no budget asked for this set | |
| S2-4 | Go to the review step | Dates read **"… → Ongoing"**. **No budget row. No wallet card** | |
| S2-5 | Publish | Publishes with no budget and no end date | |
| S2-6 | Campaigns list, then open the campaign | Both show **"Ongoing"** — never a bare dash `—` | |
| S2-7 | New campaign → one set with aim **pay for content** → set budget ₹5,000 → one creator at ₹5,000 → publish | **Refused for insufficient wallet** (yours is ₹0). This is correct. Note the amount it asks for: it should be ₹5,000 **+ 8% platform fee** | |
| S2-8 | In that same paid campaign, look at step 2's money strip | Campaign total shows **₹5,000 as text you cannot edit** — you never typed it | |
| S2-9 | Change the creator's amount to ₹7,000 | The campaign total follows to ₹7,000 by itself | |
| S2-10 | Try to find *any* box to type a campaign total, in any step | **There isn't one** | |
| S2-11 | Set that paid set's posting window to end on a date you'll remember, save, then open the campaign detail | End date equals **the last day of that posting window** — you never typed it | |
| S2-12 | Now add a **second set with aim pay per sale** to that same paid campaign, save, reopen | The end date is **gone — "Ongoing"**. One sales set keeps the whole campaign open | |
| S2-13 | Delete that sales set again, save, reopen | The end date **comes back** | |

**S2-12 is the important one.** It's the rule we worked out together: anything sales in the
campaign means the campaign never expires, so a paid deadline can't shut down your selling.

---

## Session 3 — Allocation and offers · Part 4 · web, 30 min

Open the sales campaign from S2-5 (or make another). This session includes the single most
important case in the whole script.

| # | Do this | You should see | ✓/✗ |
|---|---|---|---|
| S3-1 | Invite creator **priyacooks** to the sales set. Set commission 12%. **Do not attach any offer or discount** | It lets you save. **This was impossible before Part 4** | |
| S3-2 | In the allocation control, choose **specific products** | A search box, and results showing **image, title and price** | |
| S3-3 | Search for something, pick 3 products | The selected list shows each with image, title, price | |
| S3-4 | Switch allocation to **a category** | A **tree** you can expand, with counts at each level — not a flat dropdown | |
| S3-5 | Switch allocation to **whole store** | Accepted, no product picking needed | |
| S3-6 | Save and publish the campaign | Published | |
| S3-7 | **Now add a brand-new product** to your catalogue and publish it | — | |
| S3-8 | Come back and check what priyacooks can sell (Session 5 case S5-7 confirms it on her phone) | The new product **is included automatically**, because you allocated the whole store | |
| S3-9 | Create a **storewide 20% offer**, publish it | Live | |
| S3-10 | Also give priyacooks her own **15% offer** on one of those products | Both exist | |
| S3-11 | Session 7 will check the shopper's price on that product | Only **one** discount applies — the better one. Never both, never stacked | |

**S3-1 and S3-8 have never happened in production.** Full-price commission-only selling was
blocked by eight separate checks before Part 4, and every live collaboration today uses a
fixed product list, so whole-store auto-join has literally never run with real data.

---

## Session 4 — The handshake, brand side · Part 2 · web, 30 min

Still as **Charvitha Fashions**. Keep your phone handy — you'll switch to the creator in
Session 5 and come back here.

| # | Do this | You should see | ✓/✗ |
|---|---|---|---|
| S4-1 | Go to **Influencers** | **Five** tabs: Discover, Proposals, Groups, **Requests**, **Ready to brief** | |
| S4-2 | Find creator **arunfashion** and look at the row action | It says **"Request collab"** — not "Add" | |
| S4-3 | Click it | A composer opens. **No campaign was needed** | |
| S4-4 | Choose aim **pay per sale** | It asks for **commission % and a post-by date**, both marked negotiable | |
| S4-5 | Switch the aim to **pay for content** | It now asks for a **fee and a posting window** instead | |
| S4-6 | Look for a deliverables field | **There isn't one** — the creator proposes that themselves | |
| S4-7 | Set aim = pay per sale, 12%, post by +14 days. Set *what they'd promote* to a category and mark it **Preference** | The screen explains a preference is asked as a question | |
| S4-8 | Change that marker to **Requirement** | It explains this one must be settled and can't be countered | |
| S4-9 | Leave it as **Preference**, add a short message, send | Confirms it was sent | |
| S4-10 | Open the **Requests** tab | Your request to arunfashion, status *sent* | |
| S4-11 | **→ Go and do Session 5 cases S5-1 to S5-6 now**, then come back | — | |
| S4-12 | Back in **Requests** after the creator counters | Their counter as **old → new**, e.g. `12% → 15%`, with Accept and Decline | |
| S4-13 | Click **Accept their terms** | Confirms; they move to **Ready to brief** | |
| S4-14 | Open **Ready to brief** | arunfashion, with the agreed summary and a **"Brief into a campaign"** button | |
| S4-15 | Click it | The campaign wizard opens **pre-filled**: aim, their commission, the post-by date, the allocation | |
| S4-16 | Deliberately change the commission from 15% to 10% | A **warning naming the field** — *"arunfashion agreed 15%"* — not silence | |
| S4-17 | Put it back to 15%, publish the campaign | Published, creator invited | |
| S4-18 | Try to brief the same agreement twice (reload the Ready-to-brief link) | **Fails loudly** — already used | |

---

## Session 5 — The creator's phone · Parts 2 and 6 · 35 min

Sign in on the phone as **arunfashion** (`+919000000002`), OTP `000000`.

| # | Do this | You should see | ✓/✗ |
|---|---|---|---|
| S5-1 | Profile → Brand Proposals | **Three** tabs: Discover, **My Pitches**, **Requests** | |
| S5-2 | Open **Requests** | Charvitha Fashions' request, summarised with money and timing | |
| S5-3 | Tap it | Grouped clearly: what must be agreed, and what the brand only *prefers* | |
| S5-4 | Check the money and timing rows | Marked **negotiable** | |
| S5-5 | Check the "what you'd promote" row (you set it as a Preference) | Shown as **the brand's preference — your call** | |
| S5-6 | Tap **Counter**, change 12% to **15%**, send | Confirms. **→ Now go back to Session 4, case S4-12** | |
| S5-7 | After the brand publishes (S4-17), open **Collabs** → the new campaign | Two groups: **"✓ Already agreed with you"** showing 15% and the post-by date **with the date you agreed it**, then **"New in this campaign"** | |
| S5-8 | Look for a **Negotiate** button on that collaboration | **There is none** — you already agreed. Accept is one tap | |
| S5-9 | Tap **Accept** | A contract is generated. No second negotiation | |
| S5-10 | On the same screen, find **"You can sell"** | Words, not codes: *"Their whole store"* / a category name / *"N selected products"* | |
| S5-11 | Tap through to your products | The list matches what "You can sell" claimed | |
| S5-12 | Now open the collaboration for the campaign from **S3-1** (priyacooks — sign in as `+919000000001`) | *"You can sell: Their whole store"*, and the **new product from S3-7 is in the list** | |
| S5-13 | Requests tab → **⚙ Who can ask me** | Mute switch, bulk-outreach switch, minimum commission, minimum fee, aims | |
| S5-14 | Set **minimum commission to 20%**, save, reopen the screen | The 20% **persisted** | |
| S5-15 | → Brand: try to send this creator a request at 12% | **Refused**, telling the brand why | |
| S5-16 | Turn the mute switch **off** (brands can't ask me), save | → Brand can't send at all | |
| S5-17 | **Turn mute back on and clear the minimum**, or later sessions will fail | Restored | |
| S5-18 | **Discover** tab → look for filter chips | Industry and city chips. **Expect one industry and no cities** — see Session 0 note 2 | |
| S5-19 | Tap the industry chip | List narrows. Tapping again clears it | |
| S5-20 | Open a **cold** collaboration — sign in as `ftw_sana` (`+919000200004`), open any existing collab | **One** list of terms, **no "already agreed" box**, and **Negotiate is present**. Nothing changed for normal invites | |

**S5-20 matters as much as S5-7** — it proves the new split didn't disturb the flow that
already worked.

---

## Session 6 — The brand's phone · Parts 2 and 5 · 20 min

Sign in on the phone as **Charvitha Fashions** (`+919000000046`).

| # | Do this | You should see | ✓/✗ |
|---|---|---|---|
| S6-1 | Find Influencers → open any creator's profile | **"Request Collaboration"** sitting **above** "Invite to Campaign" | |
| S6-2 | Tap it | The same composer as the web: aim, money, timing, importance markers, **no deliverables** | |
| S6-3 | Send a request to **snehastyle** (`+919000000003`) | Confirms sent | |
| S6-4 | Find Influencers → **"Collab requests & agreed creators"** | Your sent requests, and any agreed creators under **Ready to brief** | |
| S6-5 | Read the Ready-to-brief row | It says the campaign is built on the **web** — it doesn't pretend a tap will do it | |
| S6-6 | Have snehastyle counter from her phone, then return here | The counter as **old → new**, with Accept and Decline | |
| S6-7 | Campaigns → open the sales campaign from S2-5 | Dates read **"Ongoing"** | |
| S6-8 | Look for **End campaign** on that screen | It's there | |
| S6-9 | Tap it — **read the warning, then cancel** | It states plainly that creators' products leave the shopping app and their links stop earning | |
| S6-10 | Alerts → tap any collaboration notification | Lands on the right screen, never nowhere | |

**Don't actually end a campaign yet** — that's Session 8, deliberately last.

---

## Session 7 — The shopper · Part 4 and the invisible-creator fix · 25 min

Use the follower app, or a browser in **private/incognito** so you are not logged in and not
following anyone. This session tests the money.

| # | Do this | You should see | ✓/✗ |
|---|---|---|---|
| S7-1 | As a stranger (not following anyone), browse and search for **priyacooks** | The creator and her products **are visible**. Before the fix, non-followers saw nothing | |
| S7-2 | Check her deal count / product count | **Not zero** | |
| S7-3 | Open a product she was allocated at **full price** with no offer | It's buyable | |
| S7-4 | Look hard at the price area | **No "12% off" anywhere.** Her commission must never appear as a discount to you | |
| S7-5 | Buy it — smallest value you can | Order completes | |
| S7-6 | Open the product from **S3-9/S3-10** (storewide 20% + her 15%) | **One** discount applied, the better one. Never both | |
| S7-7 | Note the exact price you paid | Write it here: ____________ | |
| S7-8 | Let an offer expire (or ask me to expire one), then reload | It stops advertising the discount **and** stops applying it | |
| S7-9 | Sign in as **priyacooks** → Earnings | Your purchase, with commission in **pending** | |
| S7-10 | Sign in as the brand → Conversions | **The same sale, the same number** | |

**Tell me when you've done S7-5** and I'll read the sale row and confirm every attribution
id landed correctly — that's the part you can't see from any screen.

---

## Session 8 — Ending a campaign · Part 5 · LAST, 10 min

Do this only after Sessions 1–7, because it takes products out of the shop.

| # | Do this | You should see | ✓/✗ |
|---|---|---|---|
| S8-1 | Web → open the **paid** campaign that has a creator awaiting your review (if any) → End campaign | **Refused**, naming the work waiting on you | |
| S8-2 | Open a **draft** campaign → look for End | **Not offered** | |
| S8-3 | Open the sales campaign from S2-5 → **End campaign** → confirm | Status becomes **Completed** — never *Cancelled* | |
| S8-4 | Sign in as priyacooks → check notifications | She was **told** the campaign ended | |
| S8-5 | As a stranger again, look for her products from that campaign | **Gone** from the shop | |
| S8-6 | Her existing earnings | **Untouched** — commission already earned stays | |
| S8-7 | Try End on that campaign again | **Refused**, already completed | |

---

## Session 9 — Do NOT test these (known, filed, unfixed)

| # | Thing | Why not |
|---|---|---|
| X-1 | **Cancelling a campaign that has money locked in escrow** | It crashes and refunds nothing. Real defect, filed. There's no such campaign today, so don't create one to try it |
| X-2 | Creators applying to join an open campaign | Deliberately not built. The brand's side exists but nothing can send an application |
| X-3 | Publishing an **open-group** set | It notifies every creator with "Apply now!" and links to a screen that doesn't exist |
| X-4 | Your 7 existing campaigns' end dates | They keep the dates they were forced to invent until you edit one of their sets. Expected |

---

## Scorecard

| Session | Cases | Passed | Failed | Notes |
|---|---|---|---|---|
| 1 — Offers & listing | 5 | | | |
| 2 — Campaign creation | 13 | | | |
| 3 — Allocation & offers | 11 | | | |
| 4 — Handshake (brand) | 18 | | | |
| 5 — Creator phone | 20 | | | |
| 6 — Brand phone | 10 | | | |
| 7 — Shopper & money | 10 | | | |
| 8 — Ending | 7 | | | |
| **Total** | **94** | | | |

### The eight cases that matter most

If you only have an hour, do these — each one covers something that has **never** worked or
**never** been done in production:

1. **S3-1** — a commission-only collaboration with no discount at all
2. **S7-5** — an actual full-price sale, the first ever
3. **S3-8 + S5-12** — a new product joining a creator's shelf by itself
4. **S2-5** — a campaign with no budget and no end date
5. **S2-12** — one sales set keeping a mixed campaign open
6. **S4-12 → S5-9** — one full handshake, counter to one-tap accept
7. **S7-1** — a stranger being able to see a creator at all
8. **S8-3** — ending a campaign as *completed*, not *cancelled*

When you hit a cross, give me the case ID. I'll read the rows behind it and tell you whether
the screen is wrong or the data is.
