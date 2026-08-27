# Batch B — impact

**Verdict: one live bug fixed, four gaps closed, and a rule that already exists finally gets a
way in. No migration.**

---

## 1. Deploy classification

| Target | What lands | Risk |
|---|---|---|
| Migration | **none** — every column already exists | **Nil** |
| Render (`backend/src`) | `POST /brands/me/offers` starts accepting the two date fields | **Low** — additive to a request body |
| Vercel | **nothing** | **Nil** |
| OTA (brand app) | the builder, and the offer moving to the creator | **Medium** |

**Creator app untouched. Follower app untouched** — it already reads and honours the dates.

---

## 2. What changes for something already live

⚠️ **Two offers exist in production, both whole-store.** After this they still are — the fix
changes what a brand *can choose*, not what is already stored. Nothing is migrated, nothing is
reinterpreted.

**What changes is future offers.** A brand who picks a category now gets a category. That is
the point, and also the risk: the phone has never written a non-store scope, so the path from
this client to the server's validator is untested by anything but the checks below.

---

## 3. What does not change

* `offer_expires_at`, the invitation-acceptance clock — a different thing, working
* Checkout's refusal of an out-of-window offer — **unchanged; this batch only feeds it values**
* The shopper's view — already reads `store_ends_at`
* Allocation, commission and the storefront — an offer stopping does not stop any of them, per
  the column's own comment
* Web

---

## 4. Rollback

OTA to the previous bundle and revert `backend/src`. Any offer created with a real scope or a
validity window **stays valid** — those columns predate this work and the server honours them
regardless of which client wrote them. Nothing to unwind.

---

## 5. The real risk

**Two builders, one shape.** The phone and web must write identical `offer_config_json`. That
is exactly the fault this codebase has already cleaned up twice — the comment at the top of
`campaignChannels.js` says so outright: *"already had to clean up two duplicated vocabularies
(offer types written differently by web and mobile, and a duplicated offer-type normaliser). A
third is not worth it."*

So the two are pinned to each other by a check that reads **both builders** and compares what
they produce — not by two lists that happen to agree today.

---

## 6. Test-suite position

The backend test database is still unreachable (since 2026-08-22). Backend assertions run as
executing checks with an injected connection, the same shape Stage 4 used. Mobile jest is
unaffected and runs normally.

Certified **no-regression**. **Never claimed green.**
