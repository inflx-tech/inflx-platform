# Commission / Creator-Store — Test Plan

Goal: prove the store + commission flow on your live system with small real transactions.
Plain-language steps + exactly what I verify in the books after each.

## Accounts you'll use
- An **influencer** account contracted with a brand (e.g. **sagartravel** — contracted
  with Chaitanya Food Court + Aveen car Rentals + 1 more).
- A **follower** account (a second phone / login) to do the buying.
- A **brand** with a live campaign offer (Chaitanya/Aveen already have offers).

---

## PART 1 — What's testable NOW (shipped)

### Test 1 — Creator can stock products  ✅ ready
1. Log in as the influencer → **My Store → "+ Stock"**.
2. You should see ONLY products from brands you're contracted with, grouped by brand.
3. Tap **+ Stock** on a few → they flip to **✓ Stocked**. Pull to refresh → still stocked.
4. Tap a **✓ Stocked** one → it unstocks.
   - ✔ Pass: only contracted-brand products appear; stock/unstock persists.
   - I verify: `influencer_store_inventory` rows appear/disappear for your influencer id.

### Test 2 — Creator Store shows the creator's picks  ✅ ready
1. As a **follower**, open that creator's store (tap their story on Home, or a "via @creator").
2. You should see the rebuilt store: hero + counters + Follow/Share, **My Store Collabs**
   (their brands), category tabs, **What {creator} Promotes**, **Top Picks 🔥**.
   - ✔ Pass: layout matches the mockup; the creator's offers show.

### Test 3 — Commission + store-context on a store purchase  ✅ ready (the money test)
> Uses a pick that is a live campaign offer (what the store shows today). Use a tiny bill.
1. As the **follower**, open the creator's store → tap a pick → **Pay at Store** → enter a
   small bill (e.g. ₹100) → pay (test card `4111 1111 1111 1111`, OTP `000000`).
2. Tell me "done" — **I then verify the books** (read-only) and report:
   - the sale recorded with **`via_store_influencer_id` = that creator** (store-context stamped),
   - **influencer_commission** credited to the creator (into pending),
   - **platform fee** charged at the influencer tier (lower than direct),
   - brand_net = bill − commission − fee.
   - ✔ Pass: creator credited, fee at influencer tier, store-context stamped.

**Run for me anytime:** `cd backend && ENV_FILE=.env.prod-backup node scripts/check-store-sale.js`
— shows the latest store-context sales with the full money breakdown.

---

## PART 2 — Remaining gaps (NOT yet testable — build after Part 1 passes)

These are the pieces still needed for the FULL "stock anything → follower buys → creator
paid from their contract rate" loop. I held them deliberately (money-path; build once the
basics above are proven):

1. **Stocked-only products don't show in the store yet.** The Creator Store currently
   lists the creator's *campaign offers*, not the new *stocked* inventory. → Build:
   surface `influencer_store_inventory` in the store feed.
2. **Buying a stocked product that has NO live campaign offer.** Today every purchase
   requires a live campaign-link; a purely-stocked product can't be checked out, and the
   creator's **contract commission rate** isn't auto-applied. → Build: a store purchase
   path that accepts store-context (no live link) and credits the creator at their
   contracted rate. This is the real money-path build; we design it after Test 3 passes.
3. **"Store beats a different creator's window"** and **Offers/Prebook store-context** —
   only pay-at-store is wired this slice.

---

## How I verify the money (read-only, no writes)
After any test purchase, I run a read-only query on your live DB and report the exact
row: 4-ID chain, `via_store_influencer_id`, `influencer_commission`, `marketplace_fee_amount`,
`brand_net`, and the classified path/fee tier. Nothing is modified — just read + explained.
