# Part 1 — Corrections

Program: Collaboration Restructure (`Docs/COLLAB_RESTRUCTURE_PLAN.md`), Part 1 of 7.
Founder approved 2026-08-11: *"your recommendation is fine, pls lock the contract and proceed."*

Five corrections. None changes structure — each makes an existing behaviour honest.
No new screens, no renamed concepts, no change to how sales / engagement / hybrid work.

---

## 1.1 — Offers must not cover unpublished products

**Today.** Nothing checks. A brand can build a discount over products that aren't pushed
to the store, so the offer covers items no customer can see.

**Founder's definition (locked):** publish means push-to-store, and that behaviour is
correct as-is. Only the offer side needs fixing.

**Second finding while auditing this.** The offer-config validator — vocabulary, shape and
product-ownership — is wired into the **library** offer path only. The **in-campaign**
inline offer path (`resolveOfferAttachment`) validates nothing at all: no shape check, no
ownership check. A brand can currently attach another brand's product IDs to a creator's
inline offer. Since the founder's model has offers created at *two* levels, the publish
rule has to hold at both, which means wiring validation into the campaign path.

**Change.**
- The validator additionally rejects products that are not pushed to the store, naming
  which ones.
- `resolveOfferAttachment` runs the validator on the inline path, closing the unvalidated
  route and applying the publish rule at both creation levels.
- Unpublishing a product that sits inside a live offer **warns and proceeds** (founder's
  call): the brand is told which offers are affected, and nothing is blocked or silently
  dropped. Rationale — blocking makes unpublishing a fight; silent dropping is the class of
  silence that caused three of the other four items on this list.

**Deliberately out of scope.** `is_active` is a separate flag from `pushed_to_store`. The
storefront requires both, but the founder defined publish as push-to-store only, so only
that flag is enforced here. Flagged, not folded in.

## 1.2 — Commission must not be displayed as a customer discount

**Today.** The creator-storefront query resolves the displayed discount as
`COALESCE(set-offer value, inline-offer value, commission_pct)`. When a sales
collaboration has a commission but no discount, it falls through to the commission — so a
10% commission is shown to the customer as "10% off", a discount checkout never applies.
Misfires only on the sales aim, the only aim where commission exists without a discount.

**Change.** Drop the `commission_pct` leg. No discount means no discount is displayed.

## 1.3 — The campaign basics money card must tell the truth

**Today.** Step 1's right rail renders a hardcoded `₹2,50,000` "covers this campaign", an
escrow-lock warning, and a pre-ticked ✓ "Wallet topped up" — to every brand, regardless of
actual balance or whether money is involved at all.

**Change.** Real wallet balance, ticks that reflect real state, and the card hidden
entirely when no set needs funding. No layout restructure — the wizard's step order,
step count and goal placement are untouched (founder: *"no don't change structure at all"*).

## 1.4 — One offer vocabulary across both apps

**Today.** `campaign_influencers.offer_type` is unconstrained `varchar(30)` and three
writers disagree:

| Writer | Values written |
|---|---|
| Web wizard | `Discount`, `Volume discount`, `BOGO`, `Bundle`, `Free gift` (display labels) |
| Mobile brand invite | `flat`, `percentage` |
| Library snapshot | `discount`, `volume`, `bogo`, `bundle`, `free_gift` |

Collaborations created in the two apps are not comparable, filterable or reportable
together.

**Canonical set** — the Offer Engine's, because it is already CHECK-constrained on
`brand_offers` and is what gets snapshotted into `ci.offer_type` when a library offer is
attached: `discount | volume | bogo | bundle | free_gift`.

**Change.**
- Web wizard sends canonical keys instead of display labels (labels stay in the UI).
- Mobile sends `discount` with the flat-vs-percentage distinction carried in the config
  sub-type, matching what the web wizard already stores.
- A migration converts existing rows.
- Read paths keep a tolerant normaliser, so any row missed by the migration still resolves
  rather than silently failing to match.

**Coupling note.** 1.4 must land with 1.1: once the validator runs on the campaign path it
enforces the canonical vocabulary, so the wizard's display labels would be rejected. These
two are one change, not two.

## 1.5 — A campaign may start today

**Today.** The wizard refuses any start date less than 7 days out. Frontend-only, no
backend counterpart.

**Change.** Remove it.

---

## What is true after Part 1

- A brand can trust what the campaign screen says about money.
- A customer is never shown a discount that doesn't exist.
- An offer cannot cover products nobody can buy — at either creation level.
- A creator's inline offer can no longer reference another brand's products.
- Reporting across web and mobile lines up.
- A brand who wants to launch today can.

## Out of scope

Everything in Parts 2–7: the pre-campaign handshake, the agreement record, retiring the
dead set-level offer path, the allocation record, no-discount selling, offer expiry, the
open-ended sales model, and the content-track merge. Part 1 removes false information;
it does not change any model.
