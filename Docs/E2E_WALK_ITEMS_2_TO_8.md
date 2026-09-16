# The whole chain, walked once — items 2 to 8

**One story, start to finish, on real phones against the real platform.**

Seven items have gone live one after another: the doors (2), discovery (3), the numbers
(3b), campaigns and sets (4), invitations (5), negotiation (6), the agreement (7) and the
pitch (8). Each was tested on its own. None of them has ever been walked as **one
continuous thing by a person**, which is the only way to find the joins that don't line up.

This is that walk. It is written as a story, not a checklist: a brand looking for creators
for a Diwali edit, and two creators who end up working with it by two different routes.
Every step tells you three things — **do this**, **you should see this**, **and this is
what it proves**.

There are **273 numbered checks** across the seven items. This walk touches about **200**
of them. The other ~73 cannot be done by a person on a phone — they are things like "two
people tapping Sign at the same millisecond" or "no row was written to a table". Section 11
lists every one of those and says how it is proved instead. Nothing is being quietly
skipped.

Allow **3 to 4 hours**. You can stop between Acts; each Act says what state you should be
in when you start it.

---

## 1. Before you start — five things to know

### 1.1 You do not need real phone numbers or real money

There is a practice cast already on the live platform. Every one of these signs in with
the OTP **`000000`** and sends no real SMS:

| Who | Number | Already set up |
|---|---|---|
| **Kanchi Silks** (brand) | `+917900000190` | 11 products, 1 branch, 5 old campaigns |
| **Label Fern** (brand) | `+917900000191` | 6 products, 1 branch |
| **Nova Fit** (brand) | `+917900000192` | 3 products, 1 branch |
| **Asha M.** (creator) | `+917900000110` | fashion |
| **Meera S.** (creator) | `+917900000111` | fashion |
| **Priya N.** (creator) | `+917900000116` | fashion |
| **Nandini G.** (creator) | `+917900000125` | beauty |
| **Ravi K.** (creator) | `+917900000115` | fitness |

There are 22 practice creators in all, `+917900000110` through `+917900000131`, and 20
practice shoppers. Any other number gets a real SMS, so stay inside this list.

**This walk uses Kanchi Silks, Asha, Meera and Nandini.** Everything else is spare.

### 1.2 Three things are pretend, and you should know which

| Thing | Real or pretend | What that means for the walk |
|---|---|---|
| **The OTP** | Pretend for the cast above | `000000` always works for them |
| **Paying money into the wallet** | **Pretend** | You can top up without a card. Everything *after* the top-up — the locking, the splitting, the ledger — is completely real |
| **Instagram and YouTube numbers** | **Pretend for the practice cast, real for one account** | The 22 practice creators carry seeded measurements (section 1.4). **Akshaya Reddy is genuinely scraped** — 193,221 followers at 5.1% — and is the shape everything else was modelled on |

Everything else is real: real database, real rules, real notifications, real agreement.

### 1.3 Every brand wallet is at ₹0, and Act 6 needs money

No rupee has ever moved on INFLX. There are zero wallet transactions and zero escrow rows
in the live database. Act 6 is where that changes for the first time.

**Step 0 of this walk is topping Kanchi Silks up to ₹50,000.** If the Add-money button on
the phone doesn't work, tell me and I'll credit it directly — but try the button first,
because if it's broken that is itself a finding.

### 1.4 The practice creators now HAVE numbers *(rewritten 16 Sep — this section used to say the opposite)*

All 22 practice creators were reading "—" for a simple reason: their Instagram handles do not
exist on Instagram, so the real Apify run came back "not found" for every one of them. No
follower count, no engagement, and no YouTube account at all. That is correct behaviour on
made-up handles, but it meant no filter, no minimum and no sort could be tested on them.

**They have been given measurements**, written into the same four places a real measurement
writes, shaped exactly like the one genuinely scraped account (Akshaya Reddy). Nothing marks
them as seeded: every filter, sort, minimum and screen treats them as measured creators.

The spread was chosen for testing, not for realism alone:

| | |
|---|---|
| **Size** | 6 nano (3k–9k) · 8 micro (22k–83k) · 5 macro (160k–310k) · 3 mega (839k–1.7m) |
| **Engagement** | 9.0% at the small end down to 1.9% at the largest — it falls as reach grows, as it really does |
| **Where** | Telangana and Andhra only: Hyderabad 6, Visakhapatnam 3, Vijayawada 2, Guntur 2, Nellore 2, Warangal 2, then Karimnagar, Tirupati, Kurnool, Rajahmundry, Kakinada |
| **Niches** | fashion 8 · fitness 5 · beauty 5 · lifestyle 4 |
| **Languages** | Telugu 22 · English 12 · Hindi 6 · Tamil 1 |

Against the minimums you set in steps 3 and 4 (10,000 followers, 2% engagement): **16 of 22
pass the follower bar, 21 pass the engagement bar, 15 pass both.** So there are creators on
both sides of every filter, and Anita at 1.9% against Pooja at exactly 2.0% gives you the
boundary.

**Two creators still show "—", and should.** Kartikeya's Instagram is private and Somepalli
Anusha's handle is not found. Those are real accounts, correctly left alone.

> **To see "Your numbers are still being measured" anyway.** Measuring everybody took away the
> only way to meet an unmeasured creator. You can put one back on purpose:
> `node backend/scripts/seed-practice-numbers.js --blank=+917900000126` (Vikram L., who this
> walk does not otherwise use). Re-run the seed with `--apply` to give him his numbers back.

### 1.5 What you need in your hands

- The **brand app** and the **influencer app**, both updated. Force-close and reopen each
  one once before you start — that is how a new bundle gets picked up. Brand should be on
  **218**, influencer on **205**.
- A way to jot notes as you go. Do not try to remember and report at the end.

---

## 2. How to record what you find

For every single thing that is wrong, note **one letter** and one line:

| | Means | What I do with it |
|---|---|---|
| **F** | **Functional** — it does the wrong thing, or nothing | Fix immediately, one at a time |
| **N** | **New** — it's missing something we never built | We discuss the scope, then build |
| **D** | **Display** — right answer, shown wrong (a date, a number, a word) | Logged and fixed in one sweep |
| **U** | **UI/UX** — it works but it's awkward | Logged and fixed in one sweep |
| **C** | **Colour** | Parked until you ask |

Write it as: **`Step 34 — F — tapping Accept did nothing, no error`**.

Log everything into `Docs/WALKTHROUGH_LEDGER.md` as you go, or just send them to me in
chat and I'll log them.

**Please do not fix anything yourself mid-walk, and don't let me either.** The point of one
pass is to see the whole chain in one state. Finish the walk, then we work through the F's.

---

## 3. ACT 1 — The two doors (item 2)

*Before this Act: nothing. This is the start.*

This Act proves the thing everything else rests on: **each side controls who may approach
it**, and neither side ever learns the other's private rules.

### Brand app — sign in as Kanchi Silks `+917900000190`

**1.** Go to Profile → Pitch settings.
*You should see:* it is fully open. All three deal types accepted, both ways of working
accepted, no minimums set. The Save button is grey because nothing has changed.
*Proves:* a brand that has never touched this screen is open to everybody (item 2, check 1).

**2.** Try to un-tick all three deal types.
*You should see:* it refuses, and says so.
*Proves:* you cannot switch yourself off by accident (check 2).

**3.** Set a minimum of **10,000 Instagram followers**. Leave YouTube blank. Save.
*Proves:* per-platform minimums (check 3).

**4.** Now set: deal types **Pay for Content** and **Pay for Sale** only (no Hybrid),
ways of working **Remote only**, and a minimum engagement of **2%**. Save.
*You should see:* it saves, and the screen reflects what you set when you come back to it.

**5.** Block **Ravi K.**, then check the list.

> **Corrected 16 Sep** — the original step said "Profile → Blocked creators", and there is no
> such row on Profile. There are two screens, not one, and blocking happens on the first:
>
> - **To block:** Creators tab → Discover → find **Ravi K.** → open him → **⋯** (top right) →
>   **Block Ravi K.** → confirm.
> - **To see who you've blocked:** Profile → **Pitch settings** → scroll to the bottom →
>   **Blocked creators**. That screen lists them and lets you unblock; it cannot add anyone.

*You should see:* after blocking, Ravi carries a "Blocked by you" chip in Discover, and he
appears on the Blocked creators list inside Pitch settings.
*Proves:* blocking works from the brand side (check 5).

### Influencer app — sign in as Asha M. `+917900000110`

**6.** Go to Profile → Invitation settings.
*You should see:* fully open, same as the brand's was.

**7.** Set your minimum fee for Pay for Content to **₹8,000**, and a minimum commission of
**12%** for Pay for Sale. Save.
*Proves:* her money floor, per deal type (checks 8, 9).

**8.** Set the brand categories you'd work with to **Women's fashion** only. Save.

> **Do this before you go on (added 16 Sep).** On the **brand app**, go to Profile →
> **Sub-categories** and make sure **Women's fashion** is ticked for Kanchi Silks. Right now
> it has **no sub-categories at all**, and the rule you approved (item 2, Q5c) is that *a
> brand with none set does not match a creator who picked categories*. So the moment Asha
> saves "Women's fashion" here, Kanchi Silks can no longer invite her — she reads **"Not open
> to this set"** in the picker at step 32, and Acts 4, 5 and 6 stop dead.
>
> This is a gap in the practice data, not a bug: the app warns the brand about it on the
> Profile row ("Choose your sub-categories so creators who filter by category can find you").
> Setting it also gives that screen a walk of its own. Verified against the live database on
> 16 Sep: Kanchi Silks `sub_categories` is empty, and Asha reads NOT_MATCHING to them because
> of it. Meera, Nandini, Priya and Ravi picked no categories, so they are unaffected.

**9.** Turn "Open to invitations" **off**, then back **on**. Save each time.
*Proves:* the pause switch (check 5).

### The doors, tested

**10.** Still as Asha — go to Collabs → Pitches → "Pitch a brand". **Kanchi Silks will not be
in the list.** Now turn the **"Brands I can pitch"** filter **off**, and look again.
*You should see:* with the filter on, six brands and no Kanchi Silks. With it off, Kanchi
Silks appears with the chip **"Being measured"** and the line *"Your numbers are still being
measured."*
*Proves:* the brand list respects the brand's settings (item 3, check 20; item 8, check 1)
— and item 8's newest sentence, a step earlier than Act 7 expects it.

> **Corrected 16 Sep.** The original step said "find Kanchi Silks · you should see she can see
> them", which cannot happen at this point in the walk and is the document's mistake, not the
> app's. In step 3 you gave Kanchi Silks a minimum of **10,000 Instagram followers**, and in
> step 4 a **2% engagement** minimum. Asha has no measured numbers at all (section 1.4), so
> she is not *refused* — she is **waiting to be measured**, and that is not the same thing.
> The list's default filter shows only brands she can pitch **today**, so a brand she is
> merely waiting on is hidden until you turn the filter off. Verified against the live
> database on 16 Sep: seven brands exist, six read OK for Asha, Kanchi Silks reads
> BEING_MEASURED.
>
> **An open question this raises** (answer it as an **N**): should a brand that is only
> *waiting on her numbers* be shown in the default list, with its sentence, rather than
> hidden with the outright refusals? "Not yet" and "no" are being treated the same here.

**11.** Sign in as **Ravi K.** `+917900000115` on the influencer app. Find Kanchi Silks the
same way.
*You should see:* **"Not accepting"** — exactly the same as a brand that had paused.
*You should NOT see:* any hint that he has been blocked.
*Proves:* **blocked and paused look identical**, which is the whole privacy promise of item 2
(checks 5, 6).

> **This is the single most important thing in Act 1.** If Ravi can tell he's been blocked,
> stop and tell me straight away.

**12.** Anywhere in Act 1, on either app: did you at any point see a number, a list or a
threshold belonging to the *other* side? A follower minimum, a niche list, a city list, the
words "blocked" from the receiving end?
*You should see:* never. Not once.
*Proves:* the privacy invariant that item 2 exists for.

---

## 4. ACT 2 — Finding each other (items 3 and 3b)

*Before this Act: Kanchi Silks has settings and has blocked Ravi. Asha has settings.*

### Brand app — Kanchi Silks

**13.** Creators tab → Discover.
*You should see:* a list of creators with a status chip on each.
*Expect (changed 16 Sep):* every practice creator now carries real-looking numbers — followers,
YouTube subscribers and an engagement percentage. Sort by **Most followers** and the list runs
from Arjun at 1.67m down to the nano creators at 3–5k. Only two creators still read "—", and
both should: a private account and a handle that does not exist.
*Proves:* the numbers reach the card, the sort and the filters (item 3, item 3b).

**14.** Search for **"asha"**. Then search for **"@asha_practice"**.
*You should see:* she's found both ways.
*Proves:* search by name and by handle (item 3, checks 8, 9).

**15.** Filter by city, then by niche.
*Proves:* the filters (check 8).

**16.** Find **Ravi K.** in Discover.
*You should see:* a **"Blocked by you"** chip.
*Proves:* your own blocks are visible to you, even though they're invisible to him (check 31).

**17.** Open **Asha's** profile.
*You should see:* her niche, her city, her handle, her numbers (dashes), and no contact
details at all.
*You should NOT see:* her phone number, her email, or any minimum fee of hers.
*Proves:* the creator profile a brand may see (checks 10, 17).

**18.** From her profile, tap through to her Instagram numbers.
*You should see:* either "Being measured"/"Updating", or real numbers if she has them.
*Proves:* item 3b's display rules — a dash, never a zero (item 3b, checks 6, 15–18).

**19.** Go back to Discover. Create a group called **"Diwali shortlist"** and add
**Asha, Meera and Nandini** to it.
*Proves:* groups (item 3, checks 13–15).

**20.** Open the group.
*You should see:* three creators, and a count of how many are open to invitations.
*Proves:* live group counts (check 19).

**21.** Rename the group to **"Diwali edit"**.
*Proves:* rename (check 18).

### Influencer app — Asha

**22.** Collabs → Pitches → "Pitch a brand".
*You should see:* a list of brands, each with a status chip, and a filter "Brands I can
pitch" that is on by default.
*Proves:* the creator's brand list (item 3, check 20).

**23.** Turn that filter **off**.
*You should see:* more brands appear, including ones you can't pitch, each saying why in a
short chip.
*Proves:* the four states a brand can be in for her (item 8, E1).

**24.** Open **Kanchi Silks**.
*You should see:* what they accept, their products, and a "Pitch this brand" button.
*You should NOT see:* their follower minimum, their engagement minimum, or their niche list.
*Proves:* the brand overview, and the privacy rule again from the other side (item 3, checks 20, 21).

---

## 5. ACT 3 — The campaign and the sets (item 4)

*Before this Act: a group of three exists.*

### Brand app — Kanchi Silks

**25.** Campaigns tab → create a campaign called **"Diwali Edit 2026"**.
*Proves:* campaign creation (item 4, check 2).

**26.** Try typing a description longer than 200 characters.
*You should see:* it stops you at 200.
*Proves:* check 2.

**27.** Inside it, create **Set A**: name it "Set A · Ethnic wear", deal type **Pay for
Content**, way of working **Remote**, posting date **30 days from today**.
*Proves:* set creation (check 3).

**28.** Try to create a set with a posting date **3 days from now**.
*You should see:* it refuses — a posting date must be at least seven days out.
*Proves:* the seven-day floor (check 5). **Remember this number; it comes back in Act 7.**

**29.** Look at Set A's detail.
*You should see:* a "replies close" date that is **three days before** the posting date.
*Proves:* the cutoff is calculated, not typed (check 5).

**30.** Create **Set B**: "Set B · Store visit", deal type **Pay for Sale**, way of working
**Store Visit**, posting date 35 days out.
*You should see:* it makes you pick a **branch**.
*Proves:* a Store Visit set must name the shop (check 4).

**31.** Delete a draft set you don't need (make a throwaway one first if you like).
*Proves:* drafts can be deleted (check 6).

---

## 6. ACT 4 — The invitations (item 5)

*Before this Act: a campaign with Set A (Content/Remote) and Set B (Sale/Store Visit).*

### Brand app — Kanchi Silks, in Set A

**32.** Add creators → pick from the **"Diwali edit"** group.
*You should see:* the three of them, each marked as eligible or not, and a count split.
*Proves:* the creator picker (item 5, checks 1–5).

> If **Asha** reads "Not open to this set" here, you skipped the sub-categories note under
> step 8. Set Kanchi Silks' sub-categories to include Women's fashion and come back; you do
> not need to redo anything else.

**33. A question, not a check.** Look for **Ravi K.** in this picker. You blocked him in
step 5.
*What the code does today:* he **is** still invitable. Blocking him in Pitch settings stops
**him pitching you**; it does not stop **you inviting him**. That is deliberate and it
matches item 8's rule that a rejection cooldown never stops a brand inviting — but it has
never been put in front of you.
*Tell me which you want:*
- **(a) Leave it** — a block means "stop contacting me", and you can still change your mind
  about working with someone. *(This is what happens now.)*
- **(b) Make it both ways** — blocking someone removes them from your picker too.

Answer it as an **N**, not an F. Nothing is broken either way.

**34.** Pick **Asha** and **Meera**. Go to terms.

**35.** For Asha, set a fee of **₹6,000**.
*You should see:* a warning that this is **below her minimum of ₹8,000** — a warning, not a
refusal. You can still send it.
*Proves:* her floor is advice to you, not a wall (item 5, check 9; item 2, check 17).

**36.** Change Asha's fee to **₹12,000**. Add deliverables: **1 Instagram reel, 2 Instagram
stories**.
*Proves:* the content package (check 7).

**37.** Try to set a deliverable count of **0**, and then of **25**.
*You should see:* both refused, with a clear message.
*Proves:* the limits are real (check 7).

**38.** For Meera, use **"Use these terms for everyone"**, then change her fee to **₹9,000**.
*Proves:* the bulk shortcut, and that you can still override one creator (check 11).

**39.** Review and send.
*You should see:* two rows go out, and the set becomes live.
*Proves:* sending (checks 17, 18).

**40.** Look at Set A now.
*You should see:* the Aim, the date and the way of working are now **locked** and cannot be
edited. The name can still be changed.
*Proves:* the first invitation locks the shape of the set (item 4, check 7).

**41.** Try to delete Set A.
*You should see:* refused, because somebody has been invited.
*Proves:* item 4, check 6.

### Influencer app — Asha

**42.** Collabs → Invites.
*You should see:* an invitation from Kanchi Silks with **₹12,000**, the deliverables written
out in words ("1 Instagram reel, 2 Instagram stories" — not a code), the posting date, and
a reply-by date.
*Proves:* item 5, checks 25–27.

**43.** Look for how the ₹12,000 will reach her.
*You should see:* it is split **25% on signing, 25% when it's live, 50% after it stays live**.
*Proves:* she is told the payment shape before she agrees (check 28).

**44.** Anywhere on that invitation — can you see the campaign's budget, the brand's notes
to itself, or what Meera was offered?
*You should see:* never.
*Proves:* checks 32, 33.

---

## 7. ACT 5 — The conversation (item 6)

*Before this Act: Asha and Meera both have an invitation to Set A.*

### Influencer app — Asha

**45.** On her invitation, tap **Counter**. Ask for **₹15,000**, and write a short reason.
*You should see:* the counter screen shows her ₹12,000 **beside** her proposed ₹15,000, and
tells her which round this is ("Round 1 of 2").
*Proves:* item 6, checks 1–3, 6.

**46.** Try sending a counter that changes nothing.
*You should see:* refused — "Change something before you send this."
*Proves:* check 4.

### Brand app — Kanchi Silks

**47.** Go to the thread with Asha.
*You should see:* her counter, old value beside new, her note, and that it's your move.
*Proves:* both sides see the same conversation (check 1).

**48.** Counter back at **₹13,000**.
*You should see:* a warning that this is the **last round**.
*Proves:* the round limit is announced before it runs out (check 7).

### Influencer app — Asha

**49.** Accept the ₹13,000.
*You should see:* the conversation ends as agreed, and the invitation now says ₹13,000.
*Proves:* accepting rewrites the terms (check 9).

### Influencer app — Meera `+917900000111`

**50.** On her invitation, instead of countering, use **"Ask to move the date"** and propose
a date about **45 days out**.
*Proves:* the move request (checks 15, 16).

**51.** Try to ask a second time.
*You should see:* refused — one move request per invitation.
*Proves:* check 16.

### Brand app — Kanchi Silks

**52.** Answer Meera's move request by **agreeing**.
*You should see:* she leaves this set and goes into your **pool** — "Agreed, needs a set".
*Proves:* the pool exists and the move request feeds it (checks 19–22).

**53.** Open the pool.
*You should see:* Meera, grouped by the date she wants, with her agreed money and how many
days her entry has left.
*Proves:* checks 20, 21.

---

## 8. ACT 6 — The agreement, and the first rupee (item 7)

*Before this Act: Asha has agreed ₹13,000 on Set A. Meera is in the pool.*

> **This is the most important Act in the walk.** It is the first time money has ever moved
> on INFLX. Go slowly and read every number.

### Brand app — Kanchi Silks

**54. Step 0 — the money.** Wallet → add **₹50,000**.
*You should see:* the balance go to ₹50,000. (This is the pretend payment from section 1.2.)
*If the button doesn't work:* that's a finding — log it **F** and tell me; I'll credit it so
you can carry on.

**55.** Go to Asha's row in Set A → **Send agreement**.
*You should see:* a preview first, showing exactly her terms — the ₹13,000, the
deliverables, the date, the way of working — and a reference number.
*You should NOT see:* any shopper offer, the campaign description, or a street address.
*Proves:* item 7, checks 1–5.

**56.** Send it.
*You should see:* it is sent, and you now cannot edit it.
*Proves:* checks 7, 8.

### Influencer app — Asha

**57.** Open the agreement.
*You should see:* the whole thing in plain words, the money broken into **three real
payments** (₹3,250 / ₹3,250 / ₹6,500 — a quarter, a quarter, a half of ₹13,000), and a line
saying nothing is binding until you both sign.
*Proves:* checks 6, 34.

> **Check the three numbers add up to exactly ₹13,000.** If they don't, that is the most
> serious kind of bug this walk can find. Log it **F** and stop.

**58.** Sign it — type her full name, tick the boxes.
*You should see:* signed, and waiting for the brand.
*Proves:* checks 10, 11.

**59.** Try to sign it again.
*You should see:* it tells you it's already signed. Nothing breaks, nothing doubles.
*Proves:* check 12.

### Brand app — Kanchi Silks

**60.** Before signing, look at what it will cost.
*You should see:* the ₹13,000 **plus an 8% campaign fee (₹1,040)** — ₹14,040 to be locked.
*Proves:* checks 14, 15.

**61.** Sign it.
*You should see:* ✅ the agreement is complete. Your wallet drops by ₹14,040. Asha's first
payment of ₹3,250 is released to her.
*Proves:* checks 15, 17, 18 — **and this is the moment the platform first moves money.**

**62.** Check the wallet ledger.
*You should see:* real entries, with the ₹13,000 locked, the ₹1,040 fee, and the ₹3,250 out.
*Proves:* check 17.

### Influencer app — Asha

**63.** Check her earnings.
*You should see:* **₹3,250 received in full** — no fee taken out of her side.
*Proves:* check 36. **She receives the agreed amount whole; the fee is the brand's.**

**64.** What is she offered next?
*You should see:* the next step opens — the shipment or shoot plan.
*Proves:* check 21.

---

## 9. ACT 7 — The pitch, and the circle closing (item 8)

*Before this Act: one signed agreement, money moved, Meera in the pool.*

This Act is the newest thing on the platform, and it is also the proof that the chain joins
up: a pitch goes in at one end and comes out as an ordinary invitation at the other.

### Influencer app — Nandini G. `+917900000125`

**65.** Collabs → Pitches → "Pitch a brand" → find **Kanchi Silks**.
*You should see:* she can pitch them. Nandini now measures **72,100 followers at 5.7%**, and
Kanchi Silks asks for 10,000 and 2%, so she clears both.
*Proves:* the brand list judges her on real numbers (item 3, check 20; item 8, check 1).

> **Rewritten 16 Sep.** This step used to expect **"Being measured"**, because nobody in the
> practice cast had numbers. They do now (section 1.4), so the step proves the ordinary case
> instead. To still see item 8's newest sentence — *"Your numbers are still being measured"* —
> blank one creator on purpose:
> `node backend/scripts/seed-practice-numbers.js --blank=+917900000126`, sign in as **Vikram L.**
> `+917900000126` and look at Kanchi Silks. He must read **"Being measured"**, never **"You don't
> match"** — he has not been measured, which is not the same as not matching. If he reads "You
> don't match", that is an **F** (item 8, check 35). Then restore him with `--apply`.

**66.** *(No longer needed — it existed only to get past the unmeasured state in step 65.
Skip it. If you blanked Vikram above, restore him now.)*

**67.** Tap **Pitch this brand**.
*You should see:* only **Pay for Content** and **Pay for Sale** offered — no Hybrid — and a
line saying Kanchi Silks don't take Hybrid pitches.
*Proves:* checks 2 — she is never offered something that would be refused.

**68.** Choose **Pay for Content**, ask for **₹20,000**, deliverables **1 reel**.
*You should see:* her own minimum shown as a reminder underneath.
*Proves:* check 2 again — her floor is a reminder, not a rule.

**69.** Next. Choose a posting date **6 days from now**.
*You should see:* refused — at least seven days.
*Proves:* check 6 — **the same seven-day floor as step 28.** One rule, two places.

**70.** Change it to **40 days out**. Way of working: **Remote** (Store Visit shouldn't even
be offered — Kanchi Silks only takes Remote).
*Proves:* check 2.

**71.** Next. Write a message. Watch the character counter.
*You should see:* before you can send, the screen tells you **three things**: Kanchi Silks
have **30 days** to reply; if they agree they'll invite you to a set and you'll sign an
agreement then, with nothing committed until you both sign; and this is your **1st open
pitch of 3 allowed**.
*Proves:* check 4 — she is never surprised by a rule she couldn't see.

**72.** Send it.

**73.** Send a **second Pay for Content pitch** to the same brand.
*You should see:* refused — you already have an open Pay for Content pitch with them.
*Proves:* check 7.

**74.** Send a **Pay for Sale** pitch to the same brand.
*You should see:* allowed.
*Proves:* check 7 — the limit is per deal type, not per brand.

### Brand app — Kanchi Silks

**75.** Creators tab → **Pitches**.
*You should see:* Nandini's two pitches under **"New"**, each with an unread dot, her
numbers (dashes), her terms and how long you have to reply.
*Proves:* checks 1, 5 of the mockups — and that a missing number shows a **dash, never a 0**.

**76.** Open the Pay for Sale one and **Reject** it.
*You should see:* **before you tap**, the sheet tells you the exact date she'll be able to
pitch you again, and separately that blocking is a different thing that lives in Pitch
settings.
*Proves:* check 23 — the consequence is stated before the tap, not after.

### Influencer app — Nandini

**77.** Check her Pitches list.
*You should see:* the rejected one, with the brand's reason if you gave one, and **"You can
pitch Kanchi Silks again after [date]"**.
*Proves:* check 23.

**78.** Try to pitch Kanchi Silks again — **any** deal type.
*You should see:* refused, with that same date.
*Proves:* check 24 — the cooldown is per brand, not per deal type.

### Brand app — Kanchi Silks

**79.** Open Nandini's remaining **Pay for Content** pitch and tap **Counter**. Offer
**₹15,000**.
*You should see:* item 6's conversation screen, exactly as in Act 5 — **and her original
pitch sitting at the bottom as the opening turn.**
*Proves:* checks 14, 15 — **one negotiation machine for the whole product.** If this screen
looks different from Asha's thread in step 47, that's worth noting.

### Influencer app — Nandini

**80.** Accept the ₹15,000.

### Brand app — Kanchi Silks

**81.** Now the single most important screen in item 8. Open the pitch and tap
**Accept her terms**.
*You should see, before you confirm:*

> Her ₹15,000 — **Agreed**
> She goes to — **Your pool**
> A collaboration — **Not yet**

*Proves:* check 16 — **accepting a pitch agrees the money and does NOT start a
collaboration.** If that third line is missing or says anything else, log it **F**.

**82.** Confirm.
*You should see:* you land in your **pool**, and Nandini is in it.

**83.** Look at the pool.
*You should see:* **Nandini and Meera side by side** — one arrived by pitching you, one by
asking to move a date — and Nandini carries a **PITCH** tag.
*Proves:* checks 17, 18 — two doors, one pool, and you can tell which is which.

**84.** Did accepting her pitch create a campaign, a set, an invitation or an agreement?
Did any money move? Check your wallet.
*You should see:* **none of it.** Wallet unchanged at whatever Act 6 left it.
*Proves:* check 16, the sentence the whole item exists for.

**85.** Tick **Nandini** in the pool and build a set for her.
*You should see:* the deal type, the date and the way of working **already filled in** from
her pitch.
*Proves:* check 19.

**86.** Finish the set and send her the invitation. The money should already be filled in at
**₹15,000**.
*Proves:* check 19.

### Influencer app — Nandini

**87.** Open the invitation.
*You should see:* an **ordinary invitation** — the same screen Asha saw in step 42 — with
**one green line** saying something like *"The ₹15,000 you agreed on [date], in a set for
[date]."*
*Proves:* check 20 — **and this is the whole chain closing.** A pitch went in at step 72 and
an ordinary invitation came out at step 87, through the pool, with no special machinery
anywhere in between.

**88.** Accept it.
*You should see:* it behaves exactly like Asha's did. From here it is item 7's agreement
again — you can sign it through if you want a second money run, or stop here.

---

## 10. ACT 8 — The things that should NOT work

*Five deliberate attempts to break it. All five should fail.*

**89.** As **Ravi K.** (blocked), find Kanchi Silks and try everything.
*Should:* look exactly like a paused brand, and never reveal the block.

**90.** As **Asha**, look at Nandini's pitch or Meera's pool entry in any way you can find.
*Should:* impossible. Nothing should show another creator's business.

**91.** As **Label Fern** `+917900000191`, look for Kanchi Silks' campaigns, sets, pitches or
pool.
*Should:* impossible. Not even a hint that they exist.

**92.** As **Kanchi Silks**, try to change the terms on an agreement you've already sent.
*Should:* refused.

**93.** Anywhere in the whole walk — did any screen ever show **₹0** where it meant "we don't
know"?
*Should:* never. It's always a dash.

---

## 11. What this walk cannot prove, and how it is proved instead

About 73 of the 273 checks cannot be done by a person on a phone. Here they are, honestly,
grouped by why.

| Why it can't be walked | Which checks | How it IS proved |
|---|---|---|
| **It's a test-suite count** | item 3 #25, 3b #25, 4 #20, 5 #35, 6 #35, 7 #32, 8 #32 & #38 | The numbers in each contract's impact note. Currently **222 failed / 1070 passed / 1292**, zero new failures across all seven items |
| **It's "no row was written"** | item 3 #16, item 8 #16, item 7 #39, item 6's money guard | Automated tests that count database rows before and after. Item 8 #16 counts seven tables around an acceptance |
| **It needs two people tapping at the same instant** | item 7 #12, #33 | Two genuinely concurrent signing requests in the test suite. A phone walk cannot produce a true race |
| **It's a fault injected inside a transaction** | item 7 #19 | The test forces a failure mid-signature and proves the money unwinds |
| **It's a search of the source code** | item 3b #22, #30, item 6 #12, item 8 #37 | Automated greps — e.g. "nothing reads the old round setting", "the Apify key is nowhere in the repo" |
| **It's the shape of an API response** | item 2's privacy invariant, item 3 #10/#26, 5 #32/#33/#42, 6 #32/#33, 7 #29/#30, 8 #29/#30 | Leak tests that scan the whole response body for words that must never appear. **Step 12, 44, 90 and 91 are the human version of the same idea** |
| **It's a job that runs on a timer** | item 6 #43, item 8 #9/#10 (7-day and 21-day reminders), item 4 #10–13 (the cutoff job) | Tests that move the clock. You'd have to wait real weeks |
| **It's a website, not a phone** | item 4 #25, item 7 #41, both admin settings pages | A separate short website pass. **Worth doing — say the word and I'll write it** |
| **It's a mocked service** | most of item 3b | Fixture-driven tests. Real Instagram reading needs Apify switched on and a spend budget |
| **It's a one-off script** | item 3b #23/#29/#31, item 5 #39 | Dry runs recorded in the contracts |

**Two admin pages cannot be proved from outside at all** — `/admin/settings/platform` (item
6's numbers) and `/admin/settings/terms` (item 7's). The website sends every admin address
to the login page whether it exists or not, so a real page and an invented one look the
same from outside. You can only confirm them by signing in as admin and looking.

---

## 12. The score sheet

Fill this in as you finish each Act.

| Act | What it proves | Steps | Done | F | N | D | U | C |
|---|---|---|---|---|---|---|---|---|
| 1 | The two doors (item 2) | 1–12 | | | | | | |
| 2 | Finding each other (items 3, 3b) | 13–24 | | | | | | |
| 3 | The campaign and the sets (item 4) | 25–31 | | | | | | |
| 4 | The invitations (item 5) | 32–44 | | | | | | |
| 5 | The conversation (item 6) | 45–53 | | | | | | |
| 6 | The agreement and the first rupee (item 7) | 54–64 | | | | | | |
| 7 | The pitch, and the circle closing (item 8) | 65–88 | | | | | | |
| 8 | The things that should not work | 89–93 | | | | | | |

### The six that matter most

If you only have an hour, do these. Each one is a place where a failure would be serious
rather than annoying.

1. **Step 11** — a blocked creator cannot tell she's blocked.
2. **Step 35** — her minimum is a warning to the brand, not a wall.
3. **Step 57** — the three payments add up to exactly the fee.
4. **Step 61** — the brand's wallet drops by the fee *plus* 8%, and her first payment lands.
5. **Step 81** — "A collaboration — **Not yet**".
6. **Step 87** — a pitch comes out the far end as an ordinary invitation.

---

## 13. Three things I already know I need an answer on

These are not bugs. They are decisions that were never put to you, and the walk will
bring you face to face with each one.

**1. Does blocking work one way or both ways?** (step 33.) Today, blocking a creator in
Pitch settings stops her pitching you but does not stop you inviting her.

**2. The return window is 30 days, not 7.** This has been open since item 7. When a shopper
buys through a creator's link, her commission is held until the return window closes. It is
set to 30 days. You asked me not to change it without telling you, because 30 may have been
somebody's deliberate decision. It still reads 30.

**3. A brand searching for creators still ranks an unmeasured creator as zero.** Item 8 fixed
this on *her* side — she now reads "Your numbers are still being measured" instead of "You
don't match". The brand's side still treats a missing follower count as 0, so unmeasured
creators sink to the bottom of Discover. Given section 1.4, **that is most of your practice
cast.** The fix is a "not measured yet" chip on the creator card. Say the word.

---

## 14. When you're done

Send me everything, in any order. I'll sort them into F / N / D / U / C, and we'll work
through the **F**s one at a time — each as its own small piece with its own test, the same
way every item was built.

When the walk is clean, all seven contracts get marked released together. That is the
moment items 2 to 8 stop being seven separate builds and become one working chain.
