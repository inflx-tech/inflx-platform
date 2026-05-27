# Flow 35 — Influencer-mobile Profile + InfluencerContracts + ContractPdf · Spec

**Bucket**: mobile-influencer redesign (Wave 2)
**Flow position**: 8/23
**Owner**: founder
**Locked**: 2026-05-27

## 1 · Problem

Three identity-tier screens still on legacy navy/teal/orange palette + DM Sans/Syne fonts:
- `ProfileScreen` (675 LOC) — settings hub with 3 inline edit modes
- `InfluencerContractsScreen` (168 LOC) — contract list with ad-hoc STATUS_COLORS
- `ContractPdfScreen` (148 LOC) — WebView PDF viewer with Download CTA

Off-brand vs Flow 28-34: navy hero, orange avatar (Profile), ad-hoc STATUS_COLORS instead of canonical StatusPill, navy chip-active, navy filter-active, navyDeep PDF header, orange Download CTA, 📨/📝 action emojis on doc rows, goldPale warning, navyPale TDS info, redPale Cancel pill.

## 2 · Goal

Visual + UX restyle to brandPalette + Outfit/Plus Jakarta Sans/JetBrains Mono fonts + StatusPill canonical migration (replaces ad-hoc STATUS_COLORS on InfluencerContractsScreen). Preserve every render branch, every API call, every save flow, every form-validation rule. Zero backend change. Zero StatusPill canonical-map additions. Zero new SDK boundaries (WebView already shipping).

## 3 · Scope

### In-scope
- `Packages/Mobile/src/screens/influencer/ProfileScreen.js` (675 LOC) — full rewrite
- `Packages/Mobile/src/screens/influencer/InfluencerContractsScreen.js` (168 LOC) — full rewrite + StatusPill canonical
- `Packages/Mobile/src/screens/influencer/ContractPdfScreen.js` (148 LOC) — full rewrite preserving WebView + role-routing

### Out-of-scope
- `backend/**` — zero backend change
- StatusPill canonical map — unchanged
- StatusBadge component — keep for other consumers
- Native build / android/** — no native rebuild (`NATIVE_RUNTIME=2` from Flow 28; WebView pre-baked)
- All previously shipped influencer screens (Flows 28-34)

## 4 · Data / dependencies

### 4.1 · API calls preserved verbatim (5 endpoints)
| API | Source screen | Use |
|---|---|---|
| `getMe()` | Profile | Load influencer.* fields |
| `updateMe(payload)` PATCH | Profile | 3 save flows (profile/content/bank) |
| `listMyContracts()` | InfluencerContracts | Contract list |
| `getContractPdfUrl(id)` | ContractPdf | Signed R2 URL (shared with brandApi via role param) |
| `clearSession()` | Profile | Logout |

### 4.2 · SDK boundary
- `react-native-webview` v13.8.7 — already installed, shipping in production today

### 4.3 · DB columns referenced
- `influencers.*` (name, bio, city, language[], niche[], youtube_handle, content_style, upi_id, bank_account_no, bank_ifsc, pan_number, instagram_handle, followers_count, engagement_rate, tier, platform, user_status, has_payout_method, has_upi, has_bank_account, has_pan, scrape_last_run)
- `contracts.*` (id, campaign_name, brand_name, status, influencer_fee, bonus_amount, brand_signed_at, created_at, campaign_goal, pdf_url)

### 4.4 · No new tables / migrations

## 5 · Risk surface

- **MED risk** — WebView SDK boundary on ContractPdf (already shipping)
- **UPI XOR Bank XOR PAN validation** in saveBank preserved
- **IFSC required** if bank_account set preserved
- **`editSection` state machine** + unsaved-changes Alert guard preserved
- **`logout` 2-confirm Alert** with destructive style preserved
- **AES-256 encryption note** preserved verbatim
- **`role` param routing** (brand vs influencer api client) on ContractPdf preserved
- **Google Docs Viewer wrap** for Android WebView PDF rendering preserved

## 6 · Success criteria

1. 3 screens render on brandPalette + Outfit/PJS/Mono
2. ALL 22 render branches preserved
3. ALL 5 APIs preserved verbatim
4. StatusPill canonical replaces ad-hoc STATUS_COLORS on InfluencerContracts
5. WebView + Google Docs Viewer wrap byte-for-byte unchanged
6. UPI/Bank/PAN XOR validation preserved
7. `editSection` state machine preserved
8. Web `pnpm qa` 76/76 GREEN gate 0 first-run
9. OTA brand v85 / influencer v74 / follower v48 published
10. lock.json `release.released = true` after deploy
11. `06-diff/notes.md` non-empty (gov-check Rule 4)
