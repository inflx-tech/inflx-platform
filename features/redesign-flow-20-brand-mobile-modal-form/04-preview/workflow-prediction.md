# Workflow Prediction — Flow 20

## Tile → backend source (Enquiries)

| Tile | Source |
|---|---|
| Filter chip counts | derived client-side from current filter (or null on "All") |
| Card follower_name | `enq.follower_name` |
| Card follower_phone | `enq.follower_phone` |
| Card "via @influencer" | `enq.influencer_name` |
| Card date | `enq.created_at` → `toLocaleString('en-IN')` |
| Card deal_value (converted) | `enq.deal_value` (rupees per migration 021) |
| Modal form_data_json rendering | `enq.form_data_json` (jsonb on enquiry_leads table) |
| Modal action: convert | `updateEnquiry(id, { status: 'converted', deal_value })` |

## Tile → backend source (ProposalInbox)

| Tile | Source |
|---|---|
| `accepts_proposals` banner / strip | `brandApi.getProposalSettings()` → `settings.accepts_proposals` boolean |
| Tab labels | hardcoded enum match `proposal.status` enum |
| Card pitch_title | `p.pitch_title` |
| Card influencer name + handle + tier | `p.influencer_name`, `p.influencer_handle`, `tierFromFollowers(p.followers_count)` (client-side derive) |
| Card status pill | `p.status` → canonical map |
| Card fee + commission + date | `p.proposed_fee` (₹), `p.proposed_commission_pct` (%), `p.created_at` |
| Modal 3-stat row | `p.followers_count` (compact format), `p.engagement_rate`, derived tier |
| Modal proposed terms | `p.goal`, `p.proposed_fee`, `p.proposed_commission_pct`, `p.proposed_deliverables` array |
| Modal portfolio_links | `p.portfolio_links` array of URLs (opened via Linking.openURL) |
| Modal rejected response | `p.brand_response_message` (rejected only) |
| Action: accept | `acceptProposal(id)` |
| Action: reject | `rejectProposal(id, msg)` |
| Action: counter | `counterProposal(id, { proposed_fee, proposed_commission_pct }, note)` |

## Tile → backend source (InfluencerProfile)

| Tile | Source |
|---|---|
| Hero avatar initials | `(inf.instagram_handle || inf.full_name).slice(0,2)` |
| Handle + verified ✓ | `inf.instagram_handle`, `inf.verified` boolean |
| Full name + tier·city·state | `inf.full_name`, `inf.tier`, `inf.city`, `inf.state` |
| Stats grid (6 tiles) | `inf.followers_count`, `inf.engagement_rate`, `inf.avg_views`, `inf.total_posts`, `inf.avg_likes`, `inf.avg_comments` |
| Bio | `inf.bio` |
| Niche chips | `inf.niche` (array or scalar) |
| Language chips | `inf.language` (array or scalar) |
| Pricing range | `inf.price_per_post_min`, `inf.price_per_post_max` (rupees) |
| Past brands (top 5) | `inf.past_brands_json` (jsonb array of strings or { name } objects) |
| InviteModal: campaign picker | `brandApi.getCampaigns()` filtered to `published`/`active`/`live` |
| InviteModal: set picker | `brandApi.getCampaignSets(campaignId)` |
| InviteModal: fee prefill | `set.per_influencer_budget` (rupees) |
| InviteModal: commission prefill | `influencer.default_commission_pct` or 10 fallback |
| InviteModal: submit | `inviteInfluencer(cId, sId, { influencer_id, agreed_fee, influencer_budget, offer_type, offer_config_json, commission_pct, posting_date })` |

## Behavior preservation

- All `Alert.alert` paths preserved (confirmation dialogs, success notifications, validation errors)
- `KeyboardAvoidingView` with iOS `padding` behavior preserved on all 3 modals
- Modal `onRequestClose` (Android back button) closes sheet without saving
- Optimistic UI: status changes flip locally before re-fetch
- Multi-step invite modal: breadcrumb-back resets sub-state cleanly (`setPickedCampaign(null)` resets `setPickedSet(null)` and `setSets([])`)

## What is NOT in this flow

- Bulk operations
- Search / filter beyond existing chips/tabs
- Per-row delete
- New modal flows
- Component extraction (deferred Flow 21)
