# Flow 32 — Expected outputs

## Per-screen rendered output assertions

### CampaignCompletion

| State | Expected render |
|---|---|
| Loading | Full-screen `ActivityIndicator` (yellow), "Loading summary..." |
| No data | "Campaign not found" + ink "Go Back" button |
| Loaded — engagement goal | Hero + earnings (no commission section) + stats + timeline + actions |
| Loaded — conversion goal | Hero + earnings WITH commission section + stats + timeline + actions |
| Loaded — hybrid goal | Same as conversion |
| Loaded — engagement metrics present | Stats card includes views/likes/comments sub-grid |
| Loaded — no engagement | Stats card has only deliverables done + content types |

### CampaignProducts

| State | Expected render |
|---|---|
| Empty product list | "No products yet" placeholder (preserved from existing logic) |
| Published product | Card with emoji-fallback + Live badge + note card + edit/remove |
| Unpublished + not editing | Card with quick-publish dashed-border footer |
| Unpublished + editing | Card with note input + Publish/Cancel CTAs |
| Publishing in flight | Disabled CTA + loading indicator |

### MyStore

| State | Expected render |
|---|---|
| Loading | Full-screen `ActivityIndicator` |
| Empty (no offers) | 🏪 emoji + "Your store is empty" |
| Has offers | Profile card + per-offer sections + per-product rows |

## Data assertions

- Total earned = sum(released tranche net) + total commissions
- Released summary = released tranche net + confirmed commissions
- Pending summary = pending tranche net + pending commissions
- 2-row summary only renders when `pending > 0`
- Type badges deduped via `Set(deliverables.type)`

## Visual evidence

Side-by-side comparison via `pnpm diff:open redesign-flow-32-influencer-mobile-completion-store` after implementation:

- `before` = `04-preview/mockups/web.html` rendered at 375×760 (one frame per screen)
- `after` = Maestro screenshot OR live `expo run:android` capture (deferred; founder physical smoke covers)
- `notes.md` will document per-screen palette + font + branch-preservation evidence

## Backend assertions (no new endpoints)

- `getMyCampaignDetail` returns same shape as Flow 31 consumes (no schema drift)
- `getCampaignCommissionDetail` returns `{ total_earned, pending_amount, confirmed_amount }`
- `getCampaignProducts` returns `[{ id, name, description, price, is_published, brand_category, image_url, ... }]`
- `getMyStorePreview` returns `{ influencer: {...}, offers: [{ offer_id, brand_name, brand_category, discount_value, offer_type, products: [...] }] }`
