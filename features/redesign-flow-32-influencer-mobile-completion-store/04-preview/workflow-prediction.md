# Flow 32 — Workflow prediction (mockup → backend source mapping)

Verifying every tile/metric in the mockup traces to a real backend field/aggregate (per `feedback_backend_first_tiles`). Read via the actual controller / SQL in `backend/src/`.

## CampaignCompletion tiles

| Mockup element | Backend source |
|---|---|
| "Sparkle Cosmetics" brand name | `getMyCampaignDetail.data.campaign.brand_name` (joined from `brands.name` via `campaign_id`) |
| "Diwali Glow-Up" campaign label | `campaign.campaign_name` |
| ₹17,000 Total Earned | `totalTrancheReleased + totalCommissions` (computed client-side from tranches + commission API) |
| T1/T2/T3 tranche rows | `escrow_entries` filtered by `campaign_influencer_id`, sorted by `tranche_number` |
| ₹4,250 / ₹4,250 / ₹8,500 tranche amounts | `escrow_entries.net_to_influencer` |
| "Released: 3 Nov 2026" tranche date | `escrow_entries.released_at` |
| Released/Pending summary | Reduced from filtered tranches + commission status flag |
| "Confirmed" commission row | `getCampaignCommissionDetail.data.confirmed_amount` |
| "Pending (30-day window)" commission row | `getCampaignCommissionDetail.data.pending_amount` |
| TDS footnote | Static (UI-only — 10% TDS rule is enforced at withdrawal API) |
| 4/4 Deliverables Done | `deliverables.filter(d => d.status ∈ {approved, live}).length / deliverables.length` |
| 2 Content Types | `new Set(deliverables.map(d => d.type)).size` |
| Type badges (Reel/Story) | DELIVERABLE_LABELS[d.type] for each unique type |
| Views/Likes/Comments | `deliverables.reduce((sum, d) => sum + (d.views/likes/comments))` |
| Timeline "Offer Accepted" date | `campaign.accepted_at` or `campaign.offer_accepted_at` |
| Timeline "Contract Signed" date | `contract.influencer_signed_at` |
| Timeline "Content Submitted" date | First `deliverables.submitted_at` or `submission_date` |
| Timeline "Content Went Live" date | First `deliverables.live_confirmed_at` |
| Timeline "Campaign Completed" date | `campaign.completed_at` or `updated_at` |

## CampaignProducts tiles

| Mockup element | Backend source |
|---|---|
| Header sub `{campaignName} · {brandName}` | Route params from CampaignDetail |
| Stats bar 5 / 2 / 3 | `products.length`, `products.filter(p => p.is_published).length`, `products.length - published` |
| Live badge | `product.is_published === true` |
| Note card "Your recommendation" | `product.note_text` (joined client-side from getProductNotes) |
| 30% OFF discount badge | `offer.discount_value` (passed in via campaign context) |
| Emoji fallback per product | `CATEGORY_EMOJI[product.brand_category] || '📦'` |
| Publish flow alert | Result of `upsertProductNote` POST |

## MyStore tiles

| Mockup element | Backend source |
|---|---|
| Avatar initial "R" | `influencer.name[0]` |
| "Riya Sharma" name | `influencer.name` |
| "@riyasharma_" handle | `influencer.instagram_handle` |
| "3 Deals" | `offers.length` |
| "8 Products" | `offers.reduce((sum, o) => sum + o.products.length, 0)` |
| Per offer brand name | `offer.brand_name` |
| Per offer 30% OFF badge | `offer.discount_value` or `offer.offer_type` |
| Per product emoji fallback | `CATEGORY_EMOJI[offer.brand_category]` |
| Per product image | `product.image_url` (if present) |
| Per product price | `product.price` (rupees post-021 migration) |
| Per product note | `product.influencer_note` (joined server-side in store-preview view) |

## Zero phantom

Every mockup metric traces to a real DB field or a derived computation on real fields. No tile invented during mockup phase. `feedback_backend_first_tiles` satisfied.
