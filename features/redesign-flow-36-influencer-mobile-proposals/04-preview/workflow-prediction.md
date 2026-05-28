# Flow 36 — Workflow prediction

## ProposalsHub tiles

| Mockup element | Backend source |
|---|---|
| Brand logo tile initials | `(brand.business_name || 'X').slice(0, 2).toUpperCase()` |
| Brand name | `brand.business_name` |
| Brand meta (category · city) | `brand.category` + `brand.brand_city` |
| Proposal title | `proposal.pitch_title` |
| "TO: BRAND_NAME" | `proposal.brand_name` (joined server-side) |
| Status pill | `proposal.status` → StatusPill canonical (6) or inline 'SENT' (1) |
| Pitch message | `proposal.pitch_message` |
| Foot fee | `proposal.proposed_fee` |
| Foot commission | `proposal.proposed_commission_pct` |
| Date | `proposal.created_at` |
| Reject reason | `proposal.brand_response_message` (when status=rejected) |
| Counter box message | `proposal.brand_response_message` (when status=countered) |
| Counter terms fee/commission | `proposal.counter_terms.proposed_fee / proposed_commission_pct` |

## SendProposal tiles

| Mockup element | Backend source |
|---|---|
| Brand name in header | route.params.brandName |
| Criteria min tier | `criteria.proposal_filters.min_tier` |
| Criteria niches | `criteria.proposal_filters.allowed_niches` |
| Criteria city match | `criteria.proposal_filters.city_match_required` + `criteria.city` |
| Criteria min ER | `criteria.proposal_filters.min_engagement_rate` |
| Criteria past collabs | `criteria.proposal_filters.only_past_collabs` |
| Goal chips | hardcoded ['engagement', 'conversion', 'hybrid'] |
| Deliverable formats | hardcoded [reel/post/story/youtube_video/youtube_short] |

## Zero phantom

Every tile traces to a real DB field or route param.
