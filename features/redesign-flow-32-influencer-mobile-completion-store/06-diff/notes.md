# Flow 32 — Before/After diff notes

## Before (legacy palette/fonts)

| Screen | Visual |
|---|---|
| CampaignCompletion | Teal-deep hero with white check icon (`[OK]`) · gold-pale Total Earned with `#7A5500` / `#5A4000` custom hex · teal/orange tranche dots · gold timeline highlight · navy/navyPale type badges · teal primary CTA · navyPale secondary CTA |
| CampaignProducts | orange-bg + white-text "🚀 Publish to My Store" CTA · tealPale Live badge · orangePale info banner with `#92400e` text · navy-themed product cards |
| MyStore | orangePale avatar tile with `colors.orangeDeep` initial · teal discount badge · orangePale note box with `#92400e` quote + `#b45309` attribution · `#fde68a` border |

## After (brandPalette + Outfit/Plus Jakarta Sans/JetBrains Mono)

| Screen | Visual |
|---|---|
| CampaignCompletion | Ink hero with yellow check (MCI `check-bold`) + yellow "Campaign Completed!" Outfit-Black title + muted-white sub + ink-mono campaign label pill · successPale Total Earned with successText (per locked design call #2) · success/yellow tranche dots (matches Flow 31) · yellowPale TDS note with yellowText · yellow-active timeline + ink-bordered yellow final highlight · yellowPale type badges · ink-bg / yellow-text "VIEW EARNINGS" Outfit-Black UPPERCASE primary CTA · ghost-ink "Back to Campaigns" secondary CTA |
| CampaignProducts | White-bg light topbar · stats bar with success-text (published) + yellow-text (pending) numbers · yellowPale info banner with yellowText · successPale Live badge (matches Flow 31 success pattern) · bg2 note card with ink italic copy + edit/remove dashed-border ink/dangerText link buttons · ink-bordered note-input field · ink-bg / yellow-text Outfit-Black "PUBLISH TO MY STORE" CTA (no 🚀 emoji per locked design call #4) · dashed-border "+ ADD NOTE & PUBLISH" quick-publish row |
| MyStore | White-bg light topbar · yellow avatar tile with ink Outfit-Black initial · ink-mono stats (3 / 8 / etc.) · successPale offer discount badges · yellowPale note boxes with yellowText italic quote + mono "— YOUR RECOMMENDATION" UPPERCASE attribution · `#F0DA88` border on note-box · CATEGORY_EMOJI fallback preserved verbatim (8 entries) |

## Per locked design call

| # | Decision | Implementation |
|---|---|---|
| 1 | Celebration hero: ink + yellow check + yellow "Completed!" title | `celebrationHeader.backgroundColor = P.ink` · `checkCircle.backgroundColor = P.yellow` · `celebrationTitle.color = P.yellow` + Outfit-Black |
| 2 | Total Earned: successPale + successText | `totalEarnedBox.backgroundColor = P.successPale` · `totalEarnedValue.color = P.successText` |
| 3 | Category emoji fallback: KEEP | `CATEGORY_EMOJI` constant unchanged in both CampaignProducts + MyStore |
| 4 | Action emoji in CTAs/alerts: DROP | `Alert.alert('Published!', ...)` not `'Published! 🎉'` · `PUBLISH TO MY STORE` not `🚀 Publish to My Store` · "Great deal!" not "Great deal 🔥" |

## Render-branch preservation evidence

| Screen | Branches preserved verbatim |
|---|---|
| CampaignCompletion | Loading / no-data / engagement / conversion / hybrid / engagement-metrics / no-engagement / TimelineItem(isFirst/isLast/highlight) sub-component |
| CampaignProducts | is_published==true (Live card) / editingProductId===id (note input) / default (quick-publish) / publishing in flight / unpublish 2-step flow |
| MyStore | Loading / empty / per-offer / per-product / image_url vs CATEGORY_EMOJI fallback / influencer_note presence |

**Total preserved**: 18 render branches across 3 files.

## API preservation evidence

All 6 APIs invoked with identical request shapes:

```js
// CampaignCompletion
Promise.all([
  influencerApi.getMyCampaignDetail(campaignInfluencerId),
  influencerApi.getCampaignCommissionDetail(campaignInfluencerId),
])

// CampaignProducts
influencerApi.getCampaignProducts(campaignInfluencerId)
influencerApi.upsertProductNote({ product_id, campaign_id, note_text })
influencerApi.getProductNotes(campaignId)
influencerApi.deleteProductNote(noteId)

// MyStore
influencerApi.getMyStorePreview()
```

All preserved verbatim. Zero new endpoints. Zero changed signatures.

## Sign-off

- Mockup locked 2026-05-26 (founder)
- Implementation locked 2026-05-27 (founder · "go and proceed to flow 33" → confirmed Flow 32 ship first via AskUserQuestion)
- Web QA: see lock.json `release.qa_evidence` for run details
- OTA versions: see lock.json `release.deploy.ota_*`
