# Flow 32 — Influencer-mobile Campaign Completion + Campaign Products + My Store · Spec

**Bucket**: mobile-influencer redesign (Wave 2)
**Flow position**: 5/23 (5th flow shipped in this bucket; preceding Flows 28–31 RELEASED)
**Owner**: founder
**Locked**: 2026-05-27

---

## 1 · Problem

Three mid-funnel post-content screens in the influencer mobile app are still on the legacy navy/teal/orange/gold palette + DM Sans / Syne fonts inherited from Wave-1:

- `CampaignCompletionScreen` (672 LOC) — terminal celebration when `campaign_influencers.status = 'completed'`
- `CampaignProductsScreen` (344 LOC) — per-campaign product-list with publish-to-store flow
- `MyStoreScreen` (209 LOC) — influencer's preview of their public follower-facing store

After Flows 28-31 shipped the Home / Notifications / OfferList / OfferDetail / Negotiation / BrandProfile / MyCampaigns / CampaignDetail screens on brandPalette + Outfit + Plus Jakarta Sans + JetBrains Mono + MaterialCommunityIcons, these three screens visually clash with the rest of the influencer surface area:

- Celebration uses teal-deep hero with white check (off-brand vs ink-and-yellow Flow 31)
- Total Earned highlight uses gold-pale (off-brand vs successPale on Earnings/Commission screens)
- Tranche/timeline dots use teal/orange (Flow 31 already migrated to success/yellow)
- Live badges use tealPale (off-brand vs successPale)
- Publish CTAs use orange-bg + white text (off-brand vs ink+yellow Flow 30/31 pattern)
- Action emoji clutter in alerts/CTAs (`🎉 Published!`, `🚀 Publish to My Store`, `🔥 Great deal`) — visually noisy; design system call to drop them
- Avatar tile + info banner + note boxes use orangePale (off-brand vs yellowPale)

## 2 · Goal

Visual + UX restyle of the 3 screens to brandPalette + Outfit/Plus Jakarta Sans/JetBrains Mono fonts. Preserve **every** render branch, **every** API call, **every** sub-component, **every** state transition, **every** business-logic computation verbatim. Zero backend change. Zero StatusPill additions. Zero new SDK boundaries.

## 3 · Scope

### In-scope

- `Packages/Mobile/src/screens/influencer/CampaignCompletionScreen.js` (672 LOC) — targeted edits + bulk token swaps (long-prefix-first), stylistic overrides per 4 locked design calls
- `Packages/Mobile/src/screens/influencer/CampaignProductsScreen.js` (344 LOC) — full rewrite (style namespace `s` lends itself to clean rewrite; preserve 4-API publish flow)
- `Packages/Mobile/src/screens/influencer/MyStoreScreen.js` (209 LOC) — full rewrite (preserve `useFocusEffect` reload + CATEGORY_EMOJI constant verbatim)

### Out-of-scope (no-touch list)

- `backend/**`, `backend/migrations/**` — zero backend change
- StatusPill canonical map — unchanged (43 entries)
- `Packages/Mobile/src/components/StatusBadge.js` — replaced inline on CampaignCompletion only via direct render (no new component)
- All previously shipped influencer screens (Flows 28-31)
- All 24 Wave-3 follower screens consuming `lightColors`
- Native build, `android/app/build.gradle`, vector-icons font config — `NATIVE_RUNTIME=2` already baked in
- `react-native-image-picker` SDK boundary (Flow 33 territory)

## 4 · Data / dependencies

### 4.1 · API calls preserved verbatim (6 endpoints)

| API | Source screen | Use |
|---|---|---|
| `getMyCampaignDetail(ciId)` | CampaignCompletion | Campaign + deliverables + contract + tranches |
| `getCampaignCommissionDetail(ciId)` | CampaignCompletion | Confirmed / pending commissions for conversion/hybrid campaigns |
| `getCampaignProducts(ciId)` | CampaignProducts | Per-campaign products list w/ `is_published` flag |
| `upsertProductNote({ product_id, campaign_id, note_text })` POST | CampaignProducts | Publish + edit (idempotent upsert) |
| `getProductNotes(campaignId)` | CampaignProducts | Find note ID for delete-flow |
| `deleteProductNote(noteId)` DELETE | CampaignProducts | Unpublish |
| `getMyStorePreview()` | MyStore | Influencer-side preview of public store (offers + products + notes) |

All 6 endpoints exist in production today. Verified via `Packages/Mobile/src/services/api.js` (Flow 32 prep audit).

### 4.2 · DB columns referenced (read-only)

- `campaign_influencers.status` ∈ {'completed'} (entry gate to CampaignCompletion)
- `campaigns.goal` ∈ {'engagement', 'conversion', 'hybrid'} (drives commission-section visibility)
- `escrow_entries.status` ∈ {'released', 'pending'} (tranche dot colour + summary breakdown)
- `escrow_entries.tranche_number` ∈ {1, 2, 3}
- `escrow_entries.net_to_influencer` (post-TDS amount; UI shows pre-TDS rupees with footnote)
- `deliverables.status` ∈ {'approved', 'live'} (completedDeliverables count)
- `deliverables.type` ∈ {'reel', 'post', 'story', 'youtube_video', 'youtube_short'} (content type badges)
- `deliverables.views / likes / comments / reach` (engagement stats — conditionally rendered)
- `products.is_published` (Boolean — drives 3 render branches: live / edit-note / quick-publish)
- `products.brand_category` (8-key map for emoji fallback)

### 4.3 · No new tables / no migrations

The 3 screens already consume only existing schema. Backend defect surface remains zero.

## 5 · Risk surface

- **Visual regression**: any prior screen consuming the same `colors.*` keys (none — these 3 are leaf screens in the redesign)
- **Render branch loss**: must preserve 4-API publish/unpublish flow + commission section visibility + completion goal logic
- **Emoji decision asymmetry**: CATEGORY_EMOJI (product cards) stays; action emoji (CTAs/alerts) drops — design call #3 vs #4
- **`useFocusEffect` reload on MyStore** preserved verbatim — DO NOT switch to `useEffect`
- **`popToTop()` on "Back to Campaigns"** preserved verbatim — DO NOT switch to `goBack()`
- **No-fake-green**: any QA failure during web `pnpm qa` post-implementation classifies as env-flake / stale / drift / regression per usual taxonomy

---

## 6 · Success criteria (verifiable)

1. 3 screens render on brandPalette + Outfit/Plus Jakarta Sans/JetBrains Mono fonts
2. ALL render branches preserved (verifiable via JS diff: 18+ branches across 3 files)
3. ALL 6 APIs preserved verbatim
4. CATEGORY_EMOJI constant unchanged (8 entries)
5. `useFocusEffect` reload preserved on MyStore
6. `popToTop()` preserved on CampaignCompletion
7. Web `pnpm qa` 76/76 GREEN gate 0 first-run (dual-probe pre-warm)
8. OTA brand v82 / influencer v71 / follower v45 published
9. lock.json `release.released = true` after deploy
10. `06-diff/notes.md` non-empty (gov-check Rule 4)
