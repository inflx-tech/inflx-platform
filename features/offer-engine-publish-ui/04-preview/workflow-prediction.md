# Workflow Prediction — offer-engine-publish-ui

Mockups: `01-offers-list.html` (the distribution badges "◧ In store" / "★ N
influencers" on each row) + `03-distribute.html` Channel ① (the "Publish to
Store" toggle + store dates). This fix implements exactly those two elements,
which were specified in the locked design but missing from the live page.

Predicted flow: brand opens Offers → on an active offer clicks "◧ Publish to
store" → row shows "◧ In store" badge → offer appears in the brand store for
followers (D1) → unpublish removes it. Edit dialog also exposes the toggle +
optional store window. Offers attached in campaigns show "★ N influencers".

Visual: matches the locked offers-list + distribute mockups (ink/yellow palette,
blue "In store" + purple "influencers" badges per Screen 01/03).
