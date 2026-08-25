# Test plan — Stages 1, 2 and 3, end to end

**Written 2026-08-26, after Stage 3 deployed.** Brand app **v187** · creator app **v182**.

Three stages, tested as one journey in the order the business actually happens:

| Part | Stage | The question it answers |
|---|---|---|
| **A** | 1 · Find each other and agree | *Before* any campaign exists — how do a brand and a creator meet and settle terms? |
| **B** | 2 · Build a campaign from the phone | *While* making the campaign — turning handshakes into live work |
| **C** | 3 · Watch the work happen | *After* — seeing every campaign, at every level, on both phones |

Every case names the **tab and the button** you press. Every label below was read out of the
running code on 2026-08-26 — if a screen says something different, that is a finding, and
write it down.

---

## 0 · Before you start

### Signing in

**There is no mock OTP.** Numbers on the allowlist get the fixed code **`000000`** and no
SMS; every other number gets a real SMS. Verified: **116 numbers are allowlisted.**

| Who | Number | Code |
|---|---|---|
| Brand — **Kanchi Silks** | `7900000190` | `000000` |
| Brand — **Label Fern** | `7900000191` | `000000` |
| Brand — **Nova Fit** | `7900000192` | `000000` |
| Creator — **Asha M.** | `7900000110` | `000000` |
| Creators — Meera S. … Sita A. | `7900000111`–`7900000131` | `000000` |
| Follower — Practice Shopper | `7900000199` | `000000` |
| **Founder / superadmin** | `8639448121` | **real SMS** |

**22 approved practice creators** and **3 approved practice brands** exist. That is enough
to test asking one person, a group, and a filtered broadcast without inventing anything.

### What is already there

* **4 groups** — *AP fashion* (6), *Fashion 1* (3), *Test group* (3), *Worked with us before* (3)
* **8 agreements** waiting to be briefed, all `ready`
* **15 conversations** — 1 sent, 3 viewed, 8 agreed, 2 countered, 1 declined
* **2 campaigns** — *Festive Season 2026* (Sarees + Reels), *Monsoon Cottons* (Cottons)
* **18 products**, all live and in stock, categorised, with pictures

### The limits that shape the tests

| Rule | Value |
|---|---|
| Broadcast cap — one ask reaches at most | **30** |
| Counters allowed, per side | **2** |
| A request expires after | **7 days** |
| An agreement lapses after | **90 days** |
| After a decline, you cannot re-ask for | **30 days** |

### Two phones

Part C needs **both apps at once** — its whole point is that the two agree. Use two handsets,
or two profiles on one.

### One warning about the labels below

Every button name in this plan was read out of the running code. **Three that I first wrote
from memory turned out not to exist** — the screens say *"Ask Asha"*, *"Ask AP fashion · 6"*
and *"Ask 4"*, not *"Request a collaboration"*, *"Ask this group"* and *"Ask several"*. They
are corrected here. If any other label reads differently on the phone, that is a finding.

### How to record a result

Mark every case **P** (works) · **F** (broken) · **D** (works, but wrong) · **?** (couldn't
tell). For F and D write **what you saw**, not what you expected — "the badge said 4 and the
sets said 1 and 1" is worth ten times "the numbers were wrong".

---

# PART A · Stage 1 — before a campaign exists

**Brand app → Creators tab.** Four sub-tabs: **Talking · Agreed · Find · Groups**.

## A1 · The three ways to ask

The same composer, three ways in. **This is the matrix the whole plan hangs off:** three ways
to ask × three kinds of deal.

| | Way | Where you start | What is different |
|---|---|---|---|
| **A1-a** | **One creator** | Creators → **Find** → tap a creator → **Ask Asha** (the button names her — *"Ask Priya"* is about the person on the screen, *"Request Collaboration"* could be anyone) | One conversation |
| **A1-b** | **A saved group** | Creators → **Groups** → open a group → **Ask AP fashion · 6** (names the group and how many) | Everyone in the group, one set of terms |
| **A1-c** | **A selected list** | Creators → **Find** → **Select** → tick several → **Ask 4** (counts what you ticked) | Only the ones you ticked |
| **A1-d** | **A filtered broadcast** | Creators → **Find** → set filters → **Show creators** → **Ask all 12** | Everyone matching, capped at 30 |

> **A1-a to A1-d each need running three times**, once per deal type in §A2. That is
> **12 sends**. Space them out — a brand is capped at how many conversations it can hold open.

**For every send, check:**

| # | Check |
|---|---|
| A1-1 | It sends without an error |
| A1-2 | It appears immediately under **Creators → Talking**, on the **Sent** side |
| A1-3 | The row shows her name, the money and the date you set |
| A1-4 | For b/c/d — **how many it says it reached**, and whether that matches how many you picked |
| A1-5 | For d — if more than 30 match, it says so rather than silently sending 30 |
| A1-6 | On **her** phone: it arrives under **Collabs → Invitations**, with a badge on the tab |

**A1-7 · The one that must fail.** Ask a creator, let her **decline**, then try to ask her
again straight away. It must be **refused**, saying she declined and when you can try again
(30 days). If it sends, that is an F.

## A2 · The three kinds of deal

In the composer, the first choice is **what you want from it**:

| | Choice | Money field | What must appear | What must NOT |
|---|---|---|---|---|
| **A2-a** | **Pay per sale** | **Commission % · negotiable** | commission, post-by date, where she'd work, what she'd promote | **no fee field**, **no deliverables** |
| **A2-b** | **Pay for content** | **Fee ₹ · negotiable** | fee, posting window, **deliverables** (reels/stories/posts) | **no commission field** |
| **A2-c** | **Both** | **both** fields | commission *and* fee, deliverables, where she'd work | — |

**Check for each:**

| # | Check |
|---|---|
| A2-1 | Switching the choice changes the fields **immediately**, with nothing stale left behind |
| A2-2 | On **Pay per sale**, there is genuinely no fee box anywhere |
| A2-3 | On **Pay for content**, there is genuinely no commission box |
| A2-4 | **Where she'd work** asks two questions: where she shoots, and **are you sending her products?** — the second only when relevant |
| A2-5 | **What they'd promote** offers **Whole store**, **A category**, **Specific products** |
| A2-6 | Choosing **A category** opens your real catalogue tree — Kanchi should show *Women › Ethnic Wear › Saree* |
| A2-7 | Choosing **Specific products** shows products **with pictures and prices** |
| A2-8 | Anything optional can be marked **Requirement** or **Preference** |
| A2-9 | On her phone, a **Requirement** cannot be countered; a **Preference** is put to her as a question |

## A3 · The negotiation, from her side

Creator app → **Collabs → Invitations** → open it.

| # | Case | Expected |
|---|---|---|
| A3-1 | She taps **ACCEPT THESE TERMS** | Agreed. It appears in the brand's **Creators → Agreed** |
| A3-2 | She taps **CHANGE SOMETHING TO COUNTER** without changing anything | Refused: *"Adjust at least one term to counter."* |
| A3-3 | She changes the commission and counters | Brand sees **old → new**, by name |
| A3-4 | She tries to change something marked **Requirement** | It is locked. She can accept or decline, not quietly alter it |
| A3-5 | She counters twice, then a third time | **Third is refused** — two per side |
| A3-6 | The brand counters back, then she accepts | Agreement created |
| A3-7 | She taps **Not interested** | Declined, with a reason. Brand sees it in **Talking** |

## A4 · The shared history — the same page, both sides

| # | Case | Expected |
|---|---|---|
| A4-1 | Brand: **Talking** → a conversation → **See how you got here** | Every offer ever made, oldest first |
| A4-2 | Her: the same conversation → the same link | **Word for word the same page** |
| A4-3 | An offer that was superseded | **Still visible.** Only the latest surviving is the old bug |

## A5 · Agreed, and the clock

| # | Case | Expected |
|---|---|---|
| A5-1 | **Creators → Agreed** | Every settled agreement, **soonest-to-expire first** |
| A5-2 | Each row | Her photo, what was settled, and **how many days left** |
| A5-3 | Anything under 14 days | Shown in **red** |
| A5-4 | An agreement with no clock | Sorts **last**, never ahead of one running out |

## A6 · Who can pitch you

| # | Case | Expected |
|---|---|---|
| A6-1 | **Creators → Talking**, top of the screen | **Who can pitch you** — states your position in words |
| A6-1b | The old creator profile also has **Invite to Campaign** | That is the **cold invite** route and is deliberately separate. Do not use it for Stage 1 — the whole point is agreeing first |
| A6-2 | Tap it | Opens the settings. Changing it takes effect |
| A6-3 | Creator: **Home → find brands to pitch** | Kanchi, Label Fern and Nova Fit are findable |
| A6-4 | She pitches | Arrives in the brand's **Talking**, on the **Received** side |

---

# PART B · Stage 2 — building the campaign

**Brand app → Campaigns tab → + New** (top right).

> **The old *"Create new campaign on web"* link must be gone.** If you can still see it, that
> is an F — two doors to one job.

## B1 · The shell

| # | Check |
|---|---|
| B1-1 | It asks exactly **two things**: a name and a start date |
| B1-2 | A note says **no end date and no budget here**, and why |
| B1-3 | **Add the first set** moves on |
| B1-4 | Backing out and returning does **not** offer to create a second campaign |

## B2 · Step 1 — the aim

Three cards. **Each states its commercial consequence, not just its name.**

| | Card | Must say |
|---|---|---|
| **B2-a** | **Sales** | *no money up front* — commission, no budget, no end date, offer required |
| **B2-b** | **Content** | *you pay a fee* — budget and end date calculated, no shopper offer |
| **B2-c** | **Both** | *fee + commission* |

| # | Check |
|---|---|
| B2-1 | A note warns the aim **cannot change** once creators are added |
| B2-2 | Re-opening a saved set shows the aim **locked** |

## B3 · Step 2 — basics, per aim

**B3-a · Sales**

| # | Check |
|---|---|
| B3a-1 | **Ends** is shown **greyed and explained**, not hidden — *"No end date on a sales set"* |
| B3a-2 | **Budget** is shown greyed — *"Commission is paid out of a sale that already happened"* |
| B3a-3 | **Channels** offers Instagram · YouTube · WhatsApp · their INFLX shop |
| B3a-4 | A **minimum channels** choice, described as **guidance that blocks nobody** |
| B3a-5 | **No "who posts?" step anywhere** |

**B3-b · Content**

| # | Check |
|---|---|
| B3b-1 | A **posting window** is asked (from / to) |
| B3b-2 | **Set ends** is **calculated**, not typed |
| B3b-3 | **What you're buying** — counters for reel, story, post, YouTube short |
| B3b-4 | **Budget** says it adds up from what you agreed at step 3 |
| B3b-5 | **No channels question** |

**B3-c · Both** — asks the content questions **and** the channels question; budget covers
**only the fee half**.

## B4 · Step 3 — the agreements pick-list

| # | Check |
|---|---|
| B4-1 | It lists **agreements you already hold**, not a creator search |
| B4-2 | Only agreements **matching this set's aim** appear |
| B4-3 | It says **how many were hidden** as the wrong aim — a silent absence is an F |
| B4-4 | Every row shows the settled terms, the date agreed and **days left** |
| B4-5 | Under 14 days shows **red** |
| B4-6 | Tapping a row opens the agreement, and **See how you got here** opens the diary |
| B4-7 | A lock note: **you cannot add someone who has not agreed** |
| B4-8 | **Go and ask someone new** takes you to the Creators tab |
| B4-9 | An agreement ticked into one set **cannot** be ticked into another set of the same campaign |

## B5 · Step 4 — ① what she gets, ② what her followers get

**① Read-back**

| # | Check |
|---|---|
| B5-1 | Each ticked creator shows her commission or fee, post-by, and where she shoots — **read back, not asked** |
| B5-2 | The only control per creator is **what she can sell** |
| B5-3 | A creator whose agreement named a scope shows it **pre-filled** |
| B5-4 | One who did not reads **Not set yet**, in red |
| B5-5 | A warning: editing an agreed term is allowed but **she is told which one moved** |

**What she can sell** — three scopes, each stating what happens to **future stock**:

| # | Case | Expected |
|---|---|---|
| B5-6 | **Your whole store** | says new products **join automatically** |
| B5-7 | **A category** | your real tree. Kanchi → *Saree · 11* |
| B5-8 | **Specific products** | the picker: **grouped by category, with pictures, prices, search, select-all**, a running count and total value |
| B5-9 | The picker's **Other · uncategorised** group | shows uncategorised stock rather than hiding it |
| B5-10 | Hand-picking | says new products **do not** join |

**② The offer** — sales and both only.

| # | Check |
|---|---|
| B5-11 | Your saved offers are listed, and one can be selected |
| B5-12 | **Make a new one** opens the builder |
| B5-13 | **See what a shopper pays** shows a sample basket: every offer that could apply, **which wins**, what the shopper pays, and **what the creator earns** |
| B5-14 | A losing offer says **why** — e.g. *"needs 3 items"* |
| B5-15 | On a **Content** set, section ② is **closed with a reason**, and **payment stages** (25/25/50) appear instead |

> **Known gap, not a finding.** The phone's offer builder cannot yet set a **minimum basket**,
> a **scope**, a **redemption mode** or an **expiry** — every phone-built offer applies to the
> whole store. Already on the Stage 2 punch list.

## B6 · Review and publish

| # | Case | Expected |
|---|---|---|
| B6-1 | Review shows starts, ends, sets, creators, wallet needed | **Ends** reads *Ongoing* if any set is sales |
| B6-2 | Change an agreed commission, then review | The drift is named — **which creator, which term** |
| B6-3 | Drift only | **Warns. Does not block** |
| B6-4 | Leave a creator with no allocation | **Blocked, naming her** |
| B6-5 | A sales set with no offer | **Blocked, naming the set** |
| B6-6 | Wallet short on a content set | **Blocked, naming the shortfall** |
| B6-7 | Publish when clean | Invites go out; the creators appear in **Campaigns** |
| B6-8 | Each creator's phone | One **Accept**, **no negotiate** — terms were already settled |
| B6-9 | **Creators → Agreed** afterwards | The briefed agreements are **gone** from the list |

**B6-10 · The one that matters most.** Start a campaign, tick **two** agreements, then **kill
the app**. Reopen. **Both agreements must still be in Creators → Agreed.** Ticking is not
briefing. If they have vanished, that is a serious F.

## B7 · Repeat the whole of Part B three times

Once per aim — **Sales**, **Content**, **Both** — and at least once build a **mixed campaign**
holding a sales set *and* a content set. On a mixed campaign the campaign's **end date must be
blank**: selling has no end, and a paid set must not close it.

---

# PART C · Stage 3 — watching the work

**Both apps open.** This part is about whether they agree.

## C1 · The tab bar

| # | Check |
|---|---|
| C1-1 | **Campaigns** and **Creators** each carry their own number |
| C1-2 | Deal with something, reopen the app | the number **goes down** |
| C1-3 | Nothing owed | **no badge at all** — not a zero |
| C1-4 | Turn the phone offline and reopen | it keeps the **last** number and says it is stale. **A zero here is an F** |

## C2 · Level 1 — the campaign list

| # | Check |
|---|---|
| C2-1 | Each running campaign carries its own number |
| C2-2 | **The campaign numbers add up to the Campaigns tab number** |
| C2-3 | An ended campaign carries **no badge**, stays greyed, and still opens |

## C3 · Level 2 — a campaign, and its sets

| # | Check |
|---|---|
| C3-1 | Anything owed **by the campaign itself** is listed **above** the sets |
| C3-2 | Each set carries its own number |
| C3-3 | **The set numbers plus the campaign-level items equal the campaign's number** |
| C3-4 | Each set shows **six little bars** — how far along it is |

## C4 · Level 3 — a set, and its creators

| # | Check |
|---|---|
| C4-1 | Anything owed **by the set itself** is above the roster, naming who or what |
| C4-2 | Every creator row shows **which of the six steps** and **whose turn** |
| C4-3 | The step is a real number, 1–6, not a status word |
| C4-4 | **Set-level items plus creators-who-owe-you equal the set's number** |

## C5 · Level 4 — one creator, her six steps

Tap a creator row. **It must open her six steps, not her public profile.**

| # | Check |
|---|---|
| C5-1 | Six steps: **Terms agreed · Signing · The shoot · Shop posts · Going live · Complete** |
| C5-2 | The current step is **open**; finished ones are ticked |
| C5-3 | Each step is badged whose it is |
| C5-4 | **Shop posts** is badged **NOT YOURS**, has **no button**, and says why |
| C5-5 | **The shoot** says its screen arrives in Stage 4 — rather than a tap that does nothing |
| C5-6 | **Terms agreed** opens the agreement · **Signing** opens the contract · **Going live** opens the review queue · **Complete** opens what it earned |
| C5-7 | Nothing on this screen is a **dead tap** |

## C6 · The one that proves the whole stage

| # | Case | Expected |
|---|---|---|
| C6-1 | Note the step for **Asha M.** on the brand phone | e.g. step 3 |
| C6-2 | Open the creator app as Asha (`7900000110` / `000000`) → **Collabs** → same collaboration | **Same six labels, same current step** |
| C6-3 | Her old spine — Invite / Nego / Sign / Active / Track / Done | **must be gone** |
| C6-4 | Her spine highlights the current step | it used to highlight nothing |
| C6-5 | The **tab she is filed under** and the **step she is on** agree | e.g. *Shoot* ↔ step 3 |

## C7 · Walk a number all the way down

Pick the **Campaigns** number and follow it to a button without leaving the app:

```
Campaigns tab number
  = campaign badges added up
      = campaign-level items  +  set badges
            = set-level items  +  creators who owe you
                  = a screen with something to press
```

| # | Check |
|---|---|
| C7-1 | Every number on that path is **on a screen** |
| C7-2 | Nowhere does a number exceed what you can find beneath it |
| C7-3 | The last thing you reach is **something you can act on** |

---

# What to look at with fresh eyes

Not pass/fail — judgement calls I need your opinion on.

| | Question |
|---|---|
| **J-1** | **Two badges instead of one.** Campaigns and Creators each carry their own. Clearer, or would one number somewhere else be better? |
| **J-2** | **The set progress bars** show the **earliest** step among its creators, not the commonest. A set with one finished and one at step 2 shows 2 — is that what you'd expect? |
| **J-3** | **"NOT YOURS"** on shop posts — does it reassure, or read like a refusal? |
| **J-4** | **The pictures.** They are stock photos, not your products. On a saree, do they read as placeholder or as wrong? |
| **J-5** | **The step names.** Do *Terms agreed · Signing · The shoot · Shop posts · Going live · Complete* say what you'd say on the phone to a creator? |

---

# Known, so don't report these

| What | Why |
|---|---|
| The phone's offer builder has no minimum basket / scope / redemption / expiry | Stage 2 punch list |
| The shoot and shop-post steps open no screen | Stages 4 and 5 |
| Cancelling one creator from a campaign fails | Pre-existing defect, filed separately |
| Nova Fit's category picker shows no tree | Its brand category is *Fitness*, which has no listing tree. Its products are still categorised |
| Product pictures are stock photography | Deliberate — swapping for real photos is one change |

---

# When you're done

Send me the **F** and **D** rows with what you actually saw. I'll classify each one — stale
fixture, business-rule drift, or a genuine defect — and carve a contract for anything real,
per the same rule the rest of this programme follows.

Three stages get marked **released** only when this plan has been walked and the Maestro flow
has run on a device. Neither has happened yet.
