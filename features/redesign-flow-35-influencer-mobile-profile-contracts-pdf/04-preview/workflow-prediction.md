# Flow 35 — Workflow prediction

## ProfileScreen tiles

| Mockup element | Backend source |
|---|---|
| Avatar "RS" initials | `(profile.instagram_handle || '??').slice(0, 2).toUpperCase()` |
| "@riyasharma_" handle | `profile.instagram_handle` |
| Name | `profile.name || profile.full_name` |
| Status dot color | function of `profile.user_status` (approved=success, pending=yellow, etc.) |
| Followers / Eng / Tier / Platform | Apify-scraped (`profile.followers_count / engagement_rate / tier / platform`) |
| Bio / City / YouTube | `profile.bio / city / youtube_handle` |
| Languages | `profile.language || []` (array of strings) |
| Niches | `profile.niche || []` (array of slugs) |
| UPI / Bank / PAN status | `profile.has_upi / has_bank_account / has_pan` (boolean flags) |
| Scrape last run | `profile.scrape_last_run` |

## InfluencerContractsScreen tiles

| Mockup element | Backend source |
|---|---|
| Campaign name | `contract.campaign_name` |
| Brand | `contract.brand_name` |
| Status pill | `contract.status` → StatusPill canonical |
| Date | `contract.brand_signed_at || contract.created_at` |
| Goal | `contract.campaign_goal` |
| Amount | `contract.influencer_fee + contract.bonus_amount` |

## ContractPdfScreen tiles

| Mockup element | Backend source |
|---|---|
| WebView source | `https://docs.google.com/gview?embedded=true&url=` + `encodeURIComponent(getContractPdfUrl(id).url)` |
| Download tap | `Linking.openURL(signedUrl)` (raw R2 URL, NOT viewer) |

## Zero phantom

Every tile traces to a real DB field or route param. No invented metrics.
