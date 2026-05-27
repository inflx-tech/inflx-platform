# Flow 32 — Workflow

**Actor**: Influencer (logged-in, role=`influencer`).

## A · CampaignCompletion view (terminal celebration)

### Preconditions
- `campaign_influencers.status = 'completed'` for the (influencer, campaign) row.
- User has tapped a completed-campaign row in `MyCampaignsScreen` → navigates to `CampaignCompletion` with `route.params.campaignInfluencerId`.

### Steps
1. Screen mounts; `useEffect` fires `loadData()`.
2. `loadData()` issues `Promise.all([getMyCampaignDetail(ciId), getCampaignCommissionDetail(ciId)])`.
3. Loading state: full-screen `ActivityIndicator` w/ "Loading summary…".
4. On success: render
   - **Ink celebration hero** with yellow check + "Campaign Completed!" (Outfit-Black, yellow) + sub copy + campaign-label pill
   - **Earnings Summary** card: successPale Total Earned + tranche rows (success/yellow dots) + commission section if `goal ∈ {conversion, hybrid}` + summary row + yellowPale TDS note
   - **Performance Stats** card: deliverables done / content types grid + yellowPale type badges + optional engagement sub-grid (views/likes/comments) if any > 0
   - **Campaign Timeline** card: 5-step vertical timeline w/ yellow-active dots + ink-bordered yellow highlight on final step
   - **Action buttons**: ink+yellow "VIEW EARNINGS" + ghost-ink "Back to Campaigns" (pop-to-top)
5. "VIEW EARNINGS" → `navigation.navigate('CommissionDetail', { campaignInfluencerId, campaignName })`.
6. "Back to Campaigns" → `navigation.popToTop()` (or `goBack()` if cannot pop).

### Failure modes
- API error → `Alert.alert('Error', errMsg)`; screen renders empty-state "Campaign not found" + Back button.
- Empty tranches → "No tranche data available." inline message.

### Success state
Influencer sees a completion summary + can navigate to detailed earnings or back to campaigns list.

---

## B · CampaignProducts view (publish-to-store hub)

### Preconditions
- User has tapped "Products" CTA on `CampaignDetailScreen` for an active/live/completed campaign.
- Route params: `{ campaignInfluencerId, campaignId, campaignName, brandName }`.

### Steps
1. `useFocusEffect` triggers `loadProducts()` on screen focus.
2. `loadProducts()` issues `getCampaignProducts(ciId)`; sets `products` state.
3. Header: ink-back chevron + "Campaign Products" title + sub `{campaignName} · {brandName}`.
4. Stats bar: 3 numbers — total products (ink) / published count (success-text) / pending count (yellow-text).
5. yellowPale info banner: "Add your personal recommendation to each product and publish it to your store."
6. Each product card has 3 possible states based on `product.is_published`:
   - **Live (`is_published === true`)**: emoji-fallback tile + name + desc + price-row (price + 30% OFF success-pale badge) + successPale Live badge + bg2 note card with "Your recommendation" + edit/remove dashed links.
   - **Pending + editing (`editingProductId === product.id`)**: product header + ink-bordered note-input field + ink+yellow "Publish to My Store" CTA + ghost cancel.
   - **Quick-publish prompt (default for unpublished)**: product header + dashed-border row "+ Add Note & Publish".
7. Publish flow: `upsertProductNote({ product_id, campaign_id, note_text })` → on success `Alert.alert('Published', '<copy>')` (no emoji per design call #4) + `loadProducts()` reload.
8. Edit flow: tap "Edit" on live card → enters editing state with current note pre-filled → re-issue upsertProductNote on save.
9. Unpublish (Remove from store) flow:
   - `getProductNotes(campaign_id)` → find by `product_id`.
   - `deleteProductNote(noteId)` → reload products.
   - `Alert.alert('Removed', '...')` on success.

### Failure modes
- `getCampaignProducts` error → empty list; pull-to-refresh available.
- `upsertProductNote` error → keep editing state; alert with error message.

### Success state
Influencer can publish recommendations on per-product basis; published items appear in My Store.

---

## C · MyStore view (preview of public follower-facing store)

### Preconditions
- User has tapped "My Store" entry in `HomeScreen` quick-actions or `InfluencerNavigator` 5-tab profile menu.
- No route params needed; uses authenticated `influencer.id` server-side.

### Steps
1. `useFocusEffect` triggers `loadStore()` on screen focus.
2. `loadStore()` issues `getMyStorePreview()`; sets `store` state.
3. Loading state: full-screen `ActivityIndicator`.
4. Header: ink-back chevron + "My Store" title + "This is what followers see" sub.
5. Profile card: yellow avatar tile (first letter, Outfit-Black ink) + name + handle + 2-stat row (deals / products).
6. Empty state (`offers.length === 0`): yellow-pale tile with 🏪 + "Your store is empty" title + helper text.
7. Per offer (campaign with at least 1 published product):
   - Offer header: brand name (Outfit) + successPale discount badge ("30% OFF" or offer_type)
   - Per product card: emoji-fallback tile (per brand_category via CATEGORY_EMOJI) OR image_url + name + desc + ink mono price + optional yellowPale note box (italic quote + "— Your recommendation" mono attribution)
8. Pull-to-refresh available.

### Failure modes
- API error → console.error + empty state.

### Success state
Influencer previews exactly what their followers see at `inflx.in/s/{handle}`.

---

## Edge cases (all preserved verbatim)

- **No image_url on product** → CATEGORY_EMOJI fallback per `brand_category`; default `📦` if category missing.
- **Conversion-only campaign with no tranches** → "No tranche data available." in CampaignCompletion.
- **`completed_at` missing** → falls back to `updated_at` in timeline.
- **Empty deliverables array** → 0/0 stat + no engagement section.
- **engagement = 0 across views/likes/comments** → engagement section hidden.
- **Goal = 'engagement'** → commission section hidden in CampaignCompletion.
- **Optimistic publish followed by network failure** → reload from server; UI reflects truth.
