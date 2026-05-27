# Flow 35 — Before/After diff notes

## Before (legacy palette/fonts)

| Screen | Visual |
|---|---|
| ProfileScreen | Navy hero · orange avatar with white initials · teal/gold/red status dots · navyPale EDIT btn + redPale CANCEL btn · border2 form inputs · navy chip-active · navy SAVE CTA · goldPale + #7A5500 warning box · navyPale + navy TDS info box · teal push toggle track · 📨📝 doc-row emojis · red logout border |
| InfluencerContractsScreen | White topbar · ad-hoc STATUS_COLORS (5 inline hex maps) · surface2 filter chips with navy-active · 📝 empty emoji · navy amount |
| ContractPdfScreen | navyDeep header · orange Download CTA · navy ActivityIndicator + retry btn · red error text |

## After (brandPalette + Outfit/PJS/Mono + StatusPill canonical)

| Screen | Visual |
|---|---|
| ProfileScreen | Ink hero with yellow rule · **yellow avatar tile with ink Outfit-Black initials** (matches Flow 32 MyStore) · success/yellow/danger status dots · bg2 EDIT pill + dangerPale CANCEL pill · ink-bordered form inputs (matches Flow 33/34) · ink-active chip · ink/yellow Outfit-Black UPPERCASE SAVE CTAs · yellowPale + #F0DA88 encryption warning box with yellowText · infoPale TDS-info box with ink text · success-green push toggle track · **MCI mail-outline + file-document-outline in yellowPale tiles** (replaces 📨📝 per design call) · danger-border LOG OUT with dangerText Outfit-Black |
| InfluencerContractsScreen | White topbar with bg2 MCI back-btn + Outfit-Bold centered title · bg2 search input · ink-active filter chips · **StatusPill canonical** (Active=successPale · Awaiting Influencer/Brand=yellowPale · Draft=bg2 muted · Cancelled=dangerPale — all already in 43-entry map; zero additions) · yellowPale dashed-border empty tile · mono ink amount |
| ContractPdfScreen | Ink hero with yellow rule + BACK chevron + Outfit-Black title · **yellow-bg + ink Outfit-Black DOWNLOAD CTA with MCI download-outline** (inverts ink/yellow pattern for pop against ink hero) · yellow ActivityIndicator + ink/yellow retry btn · dangerText error |

## Per locked design call

| # | Decision | Implementation |
|---|---|---|
| 1 | Profile avatar bg = yellow with ink initials | `avatar.backgroundColor = P.yellow` · `avatarText.color = P.ink` + Outfit-Black |
| 2 | Section action emojis (📨📝) DROPPED | MCI `email-outline` + `file-document-outline` in yellowPale tiles |
| 3 | ContractPdf Download CTA = yellow-bg + ink-text | `downloadBtn.backgroundColor = P.yellow` · `downloadBtnText.color = P.ink` (inverts the usual ink/yellow CTA pattern for visual pop against ink hero) |
| 4 | Push toggle "ON" = success-green track | `trackColor.true = P.success` |

## Render-branch preservation evidence

| Screen | Branches preserved |
|---|---|
| ProfileScreen | Loading / loaded view / 3 edit modes (profile/content/bank) / unsaved-switch Alert / save success / save error / UPI-XOR-Bank validation / IFSC-required gate / has_upi/has_bank/has_pan readonly state / has_payout_method label / logout 2-confirm |
| InfluencerContractsScreen | Loading / empty / loaded list / filter=all / filter=active / filter=pending / search active / search empty / status pill 5 variants / tap pdf_url=present → nav / tap pdf_url=missing → Alert |
| ContractPdfScreen | Missing contractId / loadingUrl / error+retry / viewerUrl render / WebView onError / role param routing brand/influencer / Linking.openURL download |

**Total preserved**: ~22 render branches across 3 files.

## API preservation evidence

```js
influencerApi.getMe()
influencerApi.updateMe({ name, bio, city })             // saveProfile
influencerApi.updateMe({ language, niche, ...content }) // saveContent
influencerApi.updateMe({ upi_id, bank_account_no, bank_ifsc, pan_number }) // saveBank
influencerApi.listMyContracts()
client.getContractPdfUrl(contractId)  // client = role === 'brand' ? brandApi : influencerApi
clearSession()  // logout
```

All preserved verbatim.

## SDK preservation

```js
import { WebView } from 'react-native-webview';

<WebView
  source={{ uri: viewerUrl }}
  startInLoadingState
  renderLoading={...}
  onError={({ nativeEvent }) => setError(nativeEvent.description || 'Render error')}
  androidLayerType="hardware"
  originWhitelist={['*']}
  style={{ flex: 1 }}
/>
```

Byte-for-byte identical.

## Sign-off

- Mockup locked 2026-05-27 (founder · "ok pls go and implement" — standing autonomy on design/lock decisions per CLAUDE.md)
- Implementation locked 2026-05-27 (same)
- Web QA: see lock.json
- OTA versions: see lock.json
