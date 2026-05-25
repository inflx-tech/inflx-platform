# Expected Outputs — Flow 19 · brand-mobile Store Preview + Campaign Sets List

## Per-step expected outputs

### Store Preview

| Step | Observable output | How QA verifies it |
|---|---|---|
| 1 | Ink topbar (#0A0A0A) with back arrow + Outfit 18 "My Store" + PJS muted "This is what customers see" | Manual on device |
| 2 | Yellow ActivityIndicator centered against BG #FAFAFA during load | Manual |
| 3 | Brand card: yellow tile with single-char ink initial + Outfit 16 business_name + success-green verified ✓ + PJS muted category + city | Manual |
| 4 | Stats strip: 3 cells with JetBrains Mono 20pt ink digits + tiny uppercase labels (mono) | Manual |
| 5 | Creators section: white card with rows (avatar + name + handle in mono + "N offers" yellow-text pill) | Manual |
| 6 | Product grid: 2-col cards (110px image area + ink name + mono price) | Manual |
| 7 | Empty state: dashed-yellow border card + yellow tile with [STORE] + Outfit title + PJS sub | Manual on empty test account |
| 8 | RefreshControl yellow-tinted, fires getMyStorePreview | Manual gesture |
| 9 | Back arrow navigates back | Manual |

### Campaign Sets List

| Step | Observable output | How QA verifies it |
|---|---|---|
| 1 | Reach via `navigate('BrandCampaignSetsList', { campaignId })` | Existing nav unchanged |
| 2 | `useFocusEffect` re-fires on focus return | Manual: navigate to InfluencersList + come back; status changes reflected |
| 3 | Ink topbar: back-pill (translucent white) "← campaign name" + Outfit 18 "Campaign sets" + mono crumb + mono count chip | Manual |
| 4 | Card per set: Outfit 14 set name + mono dates + mono budget rupees + colored goal pill + (if open_group) bg2 funnel strip + roster + yellow-pale "View all" CTA | Manual on a campaign with mixed handpick + open_group sets |
| 5 | Empty state: white card + dashed yellow border + tile + Outfit + PJS sub | Manual on empty campaign |
| 6 | "Campaign not found" + go-back yellow CTA | Manual on invalid campaignId |
| 7 | Pull-to-refresh fires getCampaign | Manual |

## Data assertions (post-workflow)

- No DB writes from either screen (read-only)
- API responses consumed: existing shapes unchanged
  - `/brands/me/store-preview` → `{ brand: { business_name, category, city, ... }, products: [{ id, name, price, image_url, section }], influencers: [{ influencer_id, name, instagram_handle, offers: [...] }] }`
  - `/campaigns/:id` → `{ campaign: { id, name, sets: [{ id, name, goal, window_start, window_end, set_budget, budget, influencer_mode, max_cap, influencers: [{ id, status, influencer_name, instagram_handle, ... }] }] } }`
- No new attribution IDs, money math, or status machines

## Visual evidence required

- **Before**: existing screens via Maestro screenshot (deferred — Maestro not wired)
- **After**: mockup HTML at 375px stands in as design contract; `design/wave2/flow-19-brand-mobile-store-sets/web.html` with 2 phone-frames + empty-state phones
- **Network**: GET `/brands/me/store-preview` succeeds; GET `/campaigns/:id` succeeds; nav to BrandCampaignInfluencersList carries `setIdFilter` query param

## Acceptance criteria summary

Founder-side device check post-OTA:

**StorePreview:**
1. Topbar is ink + Outfit (not navy + system font)
2. Brand logo tile is yellow with ink initial (not orange with white)
3. Stats use mono digits in ink (not multi-color navy/teal)
4. Products and creators sections render the same data as before
5. Empty state renders when no products

**CampaignSetsList:**
1. Already-ink topbar gets Outfit + JetBrains Mono treatment (not default system fonts)
2. Goal badges + funnel + roster all use `brandPalette` (not local inline `P`)
3. "View all" CTA still navigates to BrandCampaignInfluencersList with the right setIdFilter
4. Set with handpick mode shows roster only; set with open_group shows funnel + roster
