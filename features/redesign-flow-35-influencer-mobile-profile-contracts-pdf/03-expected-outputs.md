# Flow 35 — Expected outputs

## Per-screen rendered output assertions

### ProfileScreen
| State | Expected render |
|---|---|
| Loading | Yellow ActivityIndicator centered |
| Loaded — view | Ink hero + yellow avatar + 4-stat bar + 6 sections in read-only mode |
| editSection='profile' | Personal Details card with name/bio/city inputs + ink/yellow SAVE PROFILE INFO |
| editSection='content' | Languages & Niches card with 10+10 chips (ink-active) + youtube/style inputs |
| editSection='bank' | Payout card with UPI/Bank/IFSC/PAN inputs + yellowPale encryption warning + ink/yellow SAVE |
| has_payout_method | Edit btn label = 'UPDATE' else 'ADD' |
| Unsaved switch attempt | Alert "Unsaved changes" |
| Logout tap | 2-confirm Alert |

### InfluencerContractsScreen
| State | Expected render |
|---|---|
| Loading | Yellow ActivityIndicator |
| Empty | yellowPale dashed tile + 📝 + "No contracts yet" |
| Has contracts | FlatList with StatusPill canonical per row |
| filter='active' | Only status==='active' rows |
| filter='pending' | Only status ∈ {pending_influencer, pending_brand, draft} |
| Search non-empty | Substring match on campaign_name OR brand_name |
| Tap row no pdf_url | Alert "No PDF" |
| Tap row with pdf_url | navigate ContractPdf |

### ContractPdfScreen
| State | Expected render |
|---|---|
| No contractId | "Missing contract ID" error |
| loadingUrl=true | "Preparing contract…" + ActivityIndicator |
| Error | "Could not load PDF" + retry button |
| viewerUrl present | WebView with PDF inline + Download CTA in header |
| Download tap | `Linking.openURL(signedUrl)` |

## Data assertions

- `getMe()` returns `{ influencer: {...} }` or `{ ...}` (both shapes handled)
- `updateMe(payload)` returns updated influencer
- `listMyContracts()` returns `{ contracts: [...] }`
- `getContractPdfUrl(id)` returns `{ url: 'https://...r2...?sig=...' }`
- Avatar initials = `(profile.instagram_handle || '??').slice(0, 2).toUpperCase()`
- Status colors map: approved=success, pending=yellow, rejected/suspended=danger
- Tier display: 'Nano' default if not set

## Visual evidence

`pnpm diff:open redesign-flow-35-influencer-mobile-profile-contracts-pdf`:
- `before` = `04-preview/mockups/web.html` at 375×760 (5 frames)
- `after` = founder physical smoke-test on installed APK (NATIVE_RUNTIME=2 + WebView pre-baked)
- `notes.md` documents per-screen palette/font/branch evidence
