# Item 9 — funding and locking the money: gap report

Read-only survey, 17 September 2026. Nothing was changed, no migration was run, no money was
moved. Sources: rules doc **v1.21 §10** (Funding, Wallet Locking & Shoot Eligibility) with §9,
§14, §22 and §25; the live production database; and the code as it runs today.

---

## 1. The answer in one paragraph

**The locking is done, and it is right.** Every rule in §10 about *how much* to lock, *when* to
lock it, *who* pays the campaign fee and *what* the creator receives is built, and I proved each
one against real money already sitting in production — not against tests.

**The releasing is where item 9 is unfinished.** Of the three payments a creator is owed, only the
first has a working trigger for every kind of deal. For **Hybrid**, the second and third payments
have **no route out at all** — ₹9,375 is locked in production right now with no way to release it
except an admin doing it by hand. And the rule that the brand must be blocked from the shoot until
the money is locked has no implementation of any kind.

---

## 2. Summary

| Area | Status | In one line |
|---|---|---|
| Funds lock at full signature | **E** | Built, in one transaction, guarded against double-signing |
| How much is locked | **E** | Fee + 8% for Pay for Content; fee only for Hybrid; nothing for Pay for Sale — all three proven live |
| Campaign fee never touches the creator | **E** | She receives the agreed amount whole; the fee is a separate brand debit |
| Brand must have the money first | **E** | Shortfall shown before signing, and refused again at the server |
| First 25% released at signing | **E** | Proven live — ₹8,625 across four collaborations |
| Second 25% on content live | **P** | Works for Pay for Content. **No trigger exists for Hybrid** |
| Final 50% after the admin wait | **P** | Job is built and config-driven, but it can only fire on a payment 2 that happened |
| Shoot blocked until money is locked | **M** | **No funding check anywhere.** Only a signature check, and only on 2 of ~12 shoot endpoints |
| The brand's own wallet view | **P** | Locked money shows correctly, but the campaign fee is in no bucket, so the four numbers stop adding up |
| The admin numbers | **C** | The sales-commission return window is **30**; the rules say it **defaults to 7** |
| Two doors disagree on the money | **C** | The website's pre-check uses a different percentage and ignores the Aim — it can refuse a signature that should succeed |
| The bonus amount | **C** | Demanded from the brand before signing, then **neither locked nor paid** |

**E** exists · **P** partial · **M** missing · **C** contradicts

---

## 3. What is already true, proved with live money

This is not from tests. These are the real rows in production this morning.

| Aim | Agreed fee | Campaign fee | Locked | Rule says |
|---|---|---|---|---|
| Pay for Sale | — | ₹0 | **₹0** | no funding gate ✓ |
| Pay for Content | ₹12,000 | ₹960 | ₹12,960 | fee + 8%, once ✓ |
| Pay for Content | ₹10,000 | ₹800 | ₹10,800 | fee + 8%, once ✓ |
| Hybrid | ₹8,500 | **₹0** | ₹8,500 | no campaign fee on a Hybrid fixed amount ✓ |
| Hybrid | ₹4,000 | **₹0** | ₹4,000 | no campaign fee on a Hybrid fixed amount ✓ |

The three payments split exactly, every time — ₹8,500 becomes ₹2,125 / ₹2,125 / ₹4,250, and the
parts add back to the whole with nothing lost to rounding.

The creator has been paid **₹8,625**, which is exactly the four first payments added up, and she
received every rupee — no fee was taken from her side. The brand's ledger balances to zero:
₹36,260 paid in, ₹34,500 locked, ₹1,760 in campaign fees, ₹8,625 passed through to her.

**The campaign fee was charged on the two Pay for Content collaborations and on neither Hybrid.**
That is the subtlest money rule in §10 and it is implemented exactly.

---

## 4. The gaps, worst first

### 4.1 Hybrid can never be paid past the first 25% — **the serious one**

There are only four places in the whole platform that can release a payment: signing (the first
25%), the brand confirming content is live (the second), the waiting-period job (the final 50%),
and an admin doing it by hand.

The second one is the only automatic door to payments two and three — and it is reached by
confirming **a deliverable**. A Pay for Content collaboration has deliverables: a reel, two
stories, whatever was agreed.

**A Hybrid collaboration has none, by design.** The code says so in as many words:

> *"Hybrid with nothing named is a complete collaboration: fixed money plus shoppable posts."*

That is correct — the rules give Hybrid no content package. But it means there is no deliverable to
confirm, so the second payment has no trigger, so the third is never even queued.

Right now in production, across the two Hybrid collaborations: **₹9,375 is locked with no way out
except an admin releasing it manually.**

The rules are clear that this money is owed — §14 says Hybrid is *"25% + 25% + 50% on the upfront
amount; sale commission separate"*, and §21 says it completes *"once the required post is live and
the full fixed amount has been paid."* For Hybrid, "the post is live" means the shoppable post
(§12.1: *"Brand confirms social post is live"*) — a step that exists in the rules but releases no
money today.

**What is needed:** the shoppable-post "brand confirms live" step must release the second payment
for Hybrid, the way confirming a deliverable does for Pay for Content.

### 4.2 Nothing stops a brand reaching the shoot before the money is locked

§10 could not be plainer: *"The Brand should therefore be prevented from reaching/using the Shoot
step until these conditions are satisfied."*

There is no such check. The only gate on the shoot is "are both signatures present", it never
looks at money at all, and it is applied to just **two** of about twelve shoot endpoints. The rest
— setting the visit address, proposing a time, dispatching the parcel, marking it complete — check
only that you are one of the two parties.

Two things soften this today. Funds lock at the same instant as the second signature, so in the
normal flow a signed collaboration is a funded one. And the new chain has no shoot screen yet —
the button on the agreement says *"Shoot plan opens in item 10."*

So this is not currently losing money. But it is a rule with no implementation, and item 10 will
build the shoot on top of it. **It should be closed as part of item 9, before item 10 leans on it.**

### 4.3 The brand is asked for money that is then never locked

A contract can carry a **bonus amount**. The website's pre-check adds it to what the brand must
have in the wallet before signing. The agreement snapshot — the thing the money is actually
calculated from — never captured it.

So on any modern agreement the brand is told it needs the bonus, and then the bonus is **not
locked, not escrowed, and never paid to the creator**. It simply evaporates between the two
screens.

No live collaboration has a bonus, so nothing is broken in production today. It is a trap waiting
for the first one.

### 4.4 The website and the phone disagree about the money

Three checks on the brand website work out the cost with:

- **the wrong percentage** — a per-brand column an admin can set between 0 and 50, rather than the
  single campaign-fee setting (8%) that the agreement actually stamps and charges; and
- **no test for the Aim** — so they apply a campaign fee to Hybrid, where the rule says zero, and
  to Pay for Sale, where nothing is locked at all.

The consequence: the website can refuse a signature with "not enough money in your wallet" for a
collaboration whose real cost is **₹0**. The phone and the shared service get it right; only the
website's pre-check is wrong.

### 4.5 Smaller, but each one real

| What | Why it matters |
|---|---|
| **"Still locked" goes stale.** A field records how much has been released, and it is written only at the first payment. Nothing updates it afterwards. | Any screen showing "still locked" is wrong from the second payment onwards. |
| **The campaign fee is in no bucket.** The brand's wallet shows money loaded, available, locked and settled. The campaign fee is none of those. | The four numbers stop adding up as soon as a fee is charged. Nothing is lost — it just cannot be reconciled on screen. |
| **The waiting period has no sanity check.** An admin can set the final-payment delay to 0 days or to 3,650. | Only percentages are validated today. |
| **A locked amount can never be given back.** Locking is a straight deduction from the brand's wallet with no reverse path. | Today nothing cancels a signed agreement, so nothing needs it. The day something does, there is no way to return the money. |
| **A stale "waiting for wallet" stage survives.** A campaign still refuses to publish unless the wallet holds the whole budget, and an old `pending_wallet` status is still in the vocabulary. | §10 says funds lock at signing and *"there is no separate waiting-for-funding stage"*. This is the old model left over. |

---

## 5. The admin numbers, against the rules

| Number | Live value | Rules say | Verdict |
|---|---|---|---|
| Campaign fee | **8%** | Admin-defined | ✓ |
| Payment split | **25 / 25 / 50** | 25 / 25 / 50 | ✓ |
| Remote return window | **7 days** | 7 | ✓ |
| Final-payment wait | **30 days** | Admin-controlled; *"examples discussed were 7 or 15 days"* | Legal, but three to four times longer than anything discussed |
| **Sales-commission return window** | **30 days** | **"Admin-defined and defaults to 7 days"** (§20, and again in §25) | ✗ **wrong** |

### This answers your open question from item 7

You asked me not to change the return window from 30 without telling you, in case 30 was somebody's
deliberate decision. **The rules doc decides it: the default is 7.** It says so twice, and the v1.3
change note says it a third time. The 30 is a leftover from the old master spec, which did say 30 —
so it was deliberate once, and then the rules moved and the setting did not.

One consequence you should know before changing it: each collaboration **stamps** this number when
its agreement is generated, so a later change never moves one already in flight. Two live Hybrid
collaborations have **30** stamped on them and will keep it. Changing the setting fixes the next
collaboration, not those two.

---

## 6. What item 9 must hand to item 10

Item 10 is the shoot. It will be built directly on top of the rule in §4.2 that does not exist yet.
Before item 10 starts, item 9 should leave behind one function that answers: *may this
collaboration reach the shoot?* — true only when both signatures exist **and**, for Pay for Content
and Hybrid, the funds are locked and the first payment is released; and immediately true for Pay
for Sale, which has no funding gate.

Every shoot endpoint should call it, not just two.

---

## 7. Questions for you

**Q1 — Hybrid's second payment (§4.1). Which step releases it?** My recommendation: the brand
confirming the shoppable post is live, which is §12.1's own step and the closest match to "the
required post is live". The alternative is the admin releasing each one by hand, which does not
scale past a handful.

**Q2 — The sales-commission return window (§5).** The rules say 7. Do I set it to 7? The two live
Hybrid collaborations keep the 30 they were stamped with either way.

**Q3 — The final-payment wait is 30 days; the rules discussed 7 or 15.** Leave it at 30, or bring
it down? A creator waits 30 days after her post goes live for half her fee.

**Q4 — The bonus amount (§4.3).** Is a bonus something you still want? If yes it must go into the
snapshot and be locked and paid. If no, the cleanest fix is to remove it from the pre-check so it
stops being demanded.

**Q5 — Scope.** Do you want item 9 to fix the five smaller things in §4.5 as well, or only the
three that touch money — Hybrid's payments, the bonus, and the website's wrong percentage?

**Q6 — The shoot gate (§4.2).** Build it now as part of item 9, or hand it to item 10 as its first
job? My recommendation is now, because item 10 will otherwise build on a rule that is not there.

---

## 8. What I did not change

Nothing. No code, no migration, no setting, no money. This is Phase 1 — the report — and the next
step is your answers.

One thing was fixed separately today and is already recorded: the creator's wallet was labelling
her second and third payments *"On signing"* because the screen read a field the server does not
send. The money was never wrong; the sentence was. That is committed and tested, awaiting the same
deploy as everything else.
