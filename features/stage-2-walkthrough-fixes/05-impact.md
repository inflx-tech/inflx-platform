# Batch A — impact

**Verdict: phone-only, nine changes, eight of them deletions. No server, no database, no money.**

---

## 1. Deploy classification

| Target | What lands | Risk |
|---|---|---|
| Migration | none | **Nil** |
| Render (`backend/src`) | **nothing** | **Nil** |
| Vercel (brand-web) | **nothing** | **Nil** |
| OTA (brand app) | the wizard, shorter | **Low** |

**Creator app untouched.** Follower app untouched. This is one bundle to one app.

---

## 2. Where it could bite

**One place: the branch.** Every removal sits inside `{selling && …}` or `{!buyingContent && …}`.
Delete a block one level too high and a pay-for-content set loses a field it needs — and the
symptom would not be a crash. It would be a campaign that quietly refuses to publish later,
which is the worst kind of failure this codebase produces.

That is why `W2` exists and why `A-5` and `N-2` are separate assertions.

**Making the offer optional cannot break anything already live.** Zero rows carry an offer
today, and the columns have always been nullable.

---

## 3. What does not change

* Allocation stays compulsory on a selling set — an unrelated rule, and Stage 2 added it for a
  reason: a contracted creator with no allocation is invisible in the shopping app
* The six hidden creators stay hidden. Only the sentence explaining it moves
* The draft stays unpersisted, so abandoning the wizard still consumes no agreement
* Every server endpoint, unchanged

---

## 4. Rollback

OTA to the previous bundle. Nothing is stored, so nothing to unwind. A set saved without an
offer stays valid on the old bundle too — the old wizard only refused to *create* one that way.

---

## 5. What is knowingly left broken

⚠️ `buildDiscount` hardcodes `scope: 'store'`, so **every offer built on a phone silently applies
to the whole store.** Batch A does not fix it — it is Batch B.

Batch A makes it *less* dangerous by not forcing anyone through that builder to save a set.
Recorded here so shipping A is not mistaken for the offer work being done.
