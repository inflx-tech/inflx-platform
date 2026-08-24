# Before / after — item 1

## What was promised, and what was built

| Promised | Built |
|---|---|
| Four wrong field names on the brand page | Fixed: `brand_name`→`business_name`, `city` now sent, `gst_number`→`gstin`, `status`→`user_status` |
| Address, pincode and pin shown | New Address block: street, area — pincode, map pin |
| Creator phone sent | Sent, **admin only** |
| The hundred-fold money error | Both `/100` divisions removed |
| — | **More than promised, see below** |

## Bigger than reported

The proposal said the creator page was missing phone, last-checked and had a money fault.
Reading it properly, `GET /influencers/:id` also never sent **`created_at`**,
**`wallet_balance`**, **`pending_balance`**, **`tds_exempt`**, **`tds_override_pct`**, or a
`status` under the name the page used. So Registered, Wallet, Pending, TDS and Status were
*all* blank or zero — nearly the whole page, not the three fields reported.

## The constraint that shaped the fix

`GET /influencers/:id` is `requireRole('brand', 'admin')` — **brands call it too.** Adding
phone and balances to the shared select would have handed every brand on the platform a
creator's personal number and her earnings.

So the admin fields are a **separate query behind `req.user.role === 'admin'`**, and a test
asserts the brand response does not carry them. The public shape is unchanged.

`created_at` is deliberately in the shared select — when a creator joined is not private.

## Applied in two places, on purpose

`u.city, u.state` were added to **both** `getBrandByUserId` (a brand's own record) and
`getBrandById` (the admin lookup). The first was not required by this contract; leaving one
patched and the other not is how the two drift apart.

## Verification

The local test database was unreachable for this work — the container stops serving
connections and Docker refuses state-changing commands. New tests are written
(`tests/admin-account-review.test.js`, 5 checks) and **have not been run**.

Verified instead against production, both queries exactly as shipped:

* brand detail — business name separate from contact name, **Karnal / Haryana** now
  arriving, `user_status` = pending, `gstin` the real column, **House no. 225/7**,
  **132001**, and the map pin.
* admin-only creator block — phone, wallet, and last-checked all returned.

Brand-web builds clean.

**Not covered:** the admin HTTP path end to end. There is **no practice admin account** —
the only admin is the founder's own number, which receives real SMS codes, so no automated
check can sign in as an admin. Creating a practice admin on a fixed-code number would hand
superadmin to anyone who guessed the number, so it has not been done. **This gap is worth
solving deliberately and is recorded as owed.**

---

# Item 2 — the creator list

## What was built

`GET /v1/admin/influencers?status=&search=&page=` — deliberately the same shape as the
existing `getBrands`, so the two lists behave identically rather than each inventing its
own conventions.

The page is now the list: summary cards, the same five status tabs, search, status pills,
and click-through to a creator's account. **The bulk upload was not removed** — it moved
into a panel behind a header button. Uploading is occasional; browsing is every time.

Two deliberate choices:

* **INFLX following leads, Instagram second.** The same ordering as everywhere else, for
  the same reason: Instagram reach is who might *see* a post, INFLX following is who can
  *buy* without leaving.
* **Phone is searchable.** The practice creators are known by number, not by name.
* Pending accounts sort to the top, so anyone waiting is the first thing seen.

## Verified against production

The local test database was still unreachable, so the list query was run against
production directly, every path:

| Path | Result |
|---|---|
| Unfiltered page | 20 rows, full page |
| Every row carries a status | yes |
| INFLX counts | top 90 |
| Search by name | "deepa" → Deepa K. |
| Search by phone | "7900000119" → Anita B. |
| Search by city | "Hyderabad" → 4 |
| Status filter | 20 approved on page 1 |
| Summary | 22 total, 22 approved, 0 pending |

brand-web builds clean; both `/admin/influencers` and `/admin/influencers/[id]` compile.

Four more tests written (`tests/admin-account-review.test.js`, now 9), including one that
asserts a **brand gets 403** from the admin list. **Not run** — same reason.

---

# Item 3 — the review layout

## What changed

**The decision moved to the page that holds the facts.** Approve, Reject and Suspend now
sit on the account page itself. They used to exist only on the Approvals list, so an admin
read an account on one page, navigated away, and found the person again in a list to act on
them. Rejecting asks for a reason, and the endpoint refuses without one.

**Trading settings are hidden until a brand is in.** Override Platform Fee, L3 Commerce
Commission Override and Feature Overrides now render only for an `approved` brand — you
cannot set a meaningful fee for someone you have not admitted, and leading a review with
fee controls buries the facts the decision needs. The creator page hides **TDS Controls**
the same way: TDS is about paying someone, not about admitting them.

**Two things the screen now says out loud:**

* **"Waiting N days"** beside a pending account. How long someone has been waiting is what
  separates *new* from *forgotten*, and no list conveys it at a glance.
* **What is absent** — "No GST number, no logo." Stated plainly rather than leaving an
  admin to notice gaps by scanning for dashes. The wording makes clear none are required.

**On the creator page:** an **Open on Instagram ↗** link, and a warning when a creator has
never been scraped — *"These Instagram figures have never been checked against Instagram."*
Thirty seconds on the real profile beats any number this screen can show, and a follower
count nobody has verified should not be presented as confidently as one that has been.

## What is deliberately NOT here

No document uploads, no verification queue, no scoring. Six brands and one person waiting.
The address-versus-pin agreement check is **item 4**, still open.

## Verification

Both admin pages compile (`✓ Compiled successfully`). The endpoints were read to confirm
the page sends the shape the server accepts — `{ status, reason }` — and that
`/admin/brands/:id/status` looks up by **brand id**, which is the id the page holds. A
mismatch there would have produced a 404 on every approval.

Five more tests written (14 in the file): approve by the id the page has, reject refused
without a reason, the reason recorded, creator approval, and a brand getting 403.
**Not run** — the local test database is still unreachable.

**Still not covered end to end:** no admin HTTP path can be exercised automatically,
because there is no practice admin account. Recorded as owed.

---

# Item 4 — does the pin agree with the address?

## What it does

Both values were already stored and never compared. The page now says one of four things
under the address:

* **agrees** — "The pin agrees with the address they typed (Karnal)."
* **differs** — "Worth a look. They typed X, but the pin resolves to Y."
* **a pin with no resolved address** — nothing to compare against, said so
* **no pin at all** — said so, rather than left blank

## Deliberately a soft signal

A disagreement is **not** proof of anything, and the wording says so. A pin legitimately
resolves to the larger city that contains a locality, and Indian city names have several
accepted spellings. So it names what disagrees and leaves the judgement where it belongs.
**It never blocks approval.**

That restraint is the whole design. A check that cries wolf on a Benz Circle address with
a Vijayawada pin would be worse than no check, because it would be ignored within a week.

## Verified against every real brand, plus the two cases that matter

| Brand | Verdict |
|---|---|
| Preeti chouhan | agrees on **Karnal** |
| Fashion hub | agrees on **Guntur** |
| Aveen fashion boutique | agrees on **Kukatpally** |
| Hotel Village, and the three practice brands | no pin — said plainly |

And the two synthetic cases the design exists for:

* a **Vijayawada address with a Dubai pin** → **flagged**
* a **locality inside its own city** (Benz Circle / Vijayawada) → **not flagged**, correctly

The second matters more than the first. Any check can catch an obvious fake; the question
is whether it stays quiet when it should.

brand-web compiles.

## The other half of item 4 shipped in item 3

"Never checked against Instagram" is already on the creator page.

## All four items are now built.

---

# Follow-up — the phone number

Founder, 2026-08-24: *"phone number should also visible to admin, it is not showing now."*

## Could not reproduce it — and that is itself the finding

The onboarded-creator path was already correct and already deployed. I could not confirm
it on screen because **there is no way for me to sign in as an admin** — the only admin is
the founder's own number, which takes a real SMS. That gap has now blocked diagnosis three
times.

So rather than guess at one screen, this closes every place a number could fail to appear.

## A real gap, found while looking

`GET /influencers/:id` has **two branches**: an onboarded creator, and a **scraped**
creator profile. Only the first got an admin block. The scraped branch had none at all.

There are **45 scraped creator profiles** in production, and the table carries `bio_phone`
(scraped out of her Instagram bio) and `manual_phone` (typed in by an admin). Both were
stored and **neither could ever be seen** — a scraped creator's page offered no way to
reach her. `manual_phone` wins when both exist, because a human typed it.

Only 1 of the 45 currently has a number, so this changes little today. It stops being
nothing the moment anyone starts filling them in.

## Made unmissable rather than merely present

The number was small grey text beside the contact name — not where anyone looks for the
one thing they need to contact a business. It is now a **labelled field** on both pages,
alongside **Contact person** on the brand page and **Where** on the creator page.

## Verified against production

| Path | Result |
|---|---|
| Onboarded creator → admin | phone arrives (+917900000119) |
| Scraped creator → admin | branch runs, phone field present |
| Scraped creators holding a number | 1 of 45 |
| Brands | all 7 carry a phone |

brand-web compiles.
