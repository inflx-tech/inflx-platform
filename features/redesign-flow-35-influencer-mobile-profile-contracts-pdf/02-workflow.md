# Flow 35 — Workflow

## A · ProfileScreen

### Preconditions
- Logged-in influencer; tapped Profile tab in InfluencerNavigator.

### Steps
1. Mount → `getMe()` → populate fields via `populateFields(inf)`.
2. Ink hero renders: Outfit-Black "My Profile" title + yellow avatar (initials) + Outfit-Bold handle + mono name + success-dot status.
3. 4-stat bar renders (followers / eng rate / tier / platform — all read-only via Apify).
4. 6 sections rendered with Outfit-Black uppercase muted headers:
   - **Profile Info** card: name/phone/IG/bio/city read-only OR edit form (name, bio, city inputs)
   - **Content Preferences** card: languages/niches as 10+10 chips + youtube/content_style fields
   - **Payment & Tax** card: UPI/Bank/IFSC/PAN encrypted-status read-only OR edit form with yellowPale encryption warning
   - **App Settings** card: push toggle (success-green track)
   - **Account** card: status/handle/followers/eng-rate read-only + Apify note
   - **Brand Outreach** card: 2 doc rows with yellowPale MCI mail-outline / file-document-outline tiles → ProposalsHub + MyContracts
5. Logout flow: 2-confirm Alert → `clearSession()` + `setAppRole('')`.

### Edit modes (3 mutually exclusive)
- `editSection === 'profile'` → name+bio+city form
- `editSection === 'content'` → 10 language chips + 10 niche chips + youtube_handle + content_style
- `editSection === 'bank'` → UPI XOR Bank+IFSC XOR PAN (with AES-256 encryption warning)

### Save validation
- saveProfile: payload only includes changed fields
- saveContent: language[] + niche[] + optional youtube/style
- saveBank: cannot have both UPI AND Bank; IFSC required if Bank; AES-256 warning

### Failure modes
- Save error → Alert with error message
- Unsaved-changes guard when switching edit sections

## B · InfluencerContractsScreen

### Preconditions
- Tapped "My Contracts" doc row from Profile.

### Steps
1. Mount → `listMyContracts()`.
2. Renders:
   - White-bg light topbar with bg2 back-btn + centered Outfit-Bold title
   - Toolbar: bg2 search input + 3 filter chips (all/active/pending) with ink-active state
   - FlatList of contract cards
3. Filter logic: `'active'` → status==='active'; `'pending'` → status ∈ {pending_influencer, pending_brand, draft}
4. Search filter on campaign_name OR brand_name (substring)
5. Per-card render: Outfit-Bold campaign + mono UPPERCASE brand + StatusPill canonical + foot (mono UPPERCASE date·goal + mono ink amount)
6. Tap → if `pdf_url` present, navigate `ContractPdf({ contractId, role: 'influencer' })`; else Alert "No PDF yet"

### Empty state
- yellowPale dashed-border MCI tile + "No contracts yet" + helper copy

## C · ContractPdfScreen

### Preconditions
- Tapped contract card with `pdf_url` present in InfluencerContracts; route params `{ contractId, role }`.

### Steps
1. Mount → `loadUrl()`.
2. `loadUrl()`:
   - `client = role === 'brand' ? brandApi : influencerApi`
   - `getContractPdfUrl(contractId)` → `{ url }` = signed R2 URL
   - `viewerUrl = 'https://docs.google.com/gview?embedded=true&url=' + encodeURIComponent(url)`
3. 3-state machine:
   - `loadingUrl` → "Preparing contract…" + yellow ActivityIndicator
   - `error` → "Could not load PDF" + retry button
   - `viewerUrl` present → WebView with renderLoading + onError + androidLayerType='hardware' + originWhitelist=['*']
4. Download CTA: `Linking.openURL(signedUrl)` for raw R2 download (NOT viewer)

### Failure modes
- WebView render error → setError(nativeEvent.description)
- Retry button re-fires loadUrl

### Success state
PDF rendered inline; user can download via system browser.
