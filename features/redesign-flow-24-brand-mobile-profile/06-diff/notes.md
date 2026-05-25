# Flow 24 — before/after diff notes

## Files touched
- **Modified**: `Packages/Mobile/src/screens/brand/BrandProfileScreen.js` — full visual rewrite, behavior preserved 1:1
- **NOT touched**: theme/tokens.js, StatusPill (canonical map already covers approved/pending/rejected), ScreenHeader/EmptyState (Profile has custom hero + custom empty-line — not a fit for the extracted components)

## Visual delta
| Element | Before | After |
|---|---|---|
| Hero bg | navyDeep | ink |
| Avatar | 72×72 orange + white initials | 72×72 yellow + ink Outfit initials |
| Brand name | system bold 20 white | Outfit-Bold 20 white -0.3 letterSpacing |
| Status chip | inline approved (teal+30) / pending (orange+30) | canonical `<StatusPill status={user_status} />` (approved→successPale, pending→bg2, rejected→dangerPale) |
| Status banner — pending | `#FFFBEB` bg + `#FDE68A` border + `#92400E` text | yellowPale bg + yellow border + yellowText (Outfit title + PJS sub) |
| Status banner — rejected | `#FEF2F2` bg + `#FCA5A5` border + `#991B1B` text | dangerPale bg + dangerPale border + dangerText |
| Card | colors.white + colors.border + system bold title | brandPalette.white + brandPalette.border + Outfit-Bold uppercase title with letterSpacing 0.4 |
| Field label | system bold 11 t2 uppercase | mono bold 9.5 muted uppercase letterSpacing 0.4 |
| Field hint | system 10 t3 | PJS Medium 9.5 muted2 |
| Input | system 13 t1, 1.5px border | PJS Medium 12.5 ink, 1.5px border (mono for GSTIN / Pincode / URLs / Phone) |
| Input read-only | colors.bg + t3 | bg2 + muted3 |
| Primary chip (Main Branch) | tealPale + tealDeep | successPale + successText (mono Bold) |
| + Add Branch button | orange border + orange text | yellow border + yellowText (sansBold pill) |
| Branch box | colors.border + colors.white | brandPalette.border + bg (subtly darker than card to distinguish) |
| Branch index label | system 10 t3 uppercase | monoBold 9 muted2 uppercase letterSpacing 0.4 |
| Remove link | colors.red | dangerText sansBold |
| Save Changes CTA | orange + white system bold 14 | yellow + ink Outfit-Bold 14 letterSpacing 0.3 |
| Other links icon | system bold 12 t2 | monoBold 10.5 muted |
| Other links label | system 13 t1 | sansBold 12.5 ink |
| Other links arrow | system 18 t3 | monoBold 16 muted3 |
| Other links hint | system 10 t3 | PJS Medium 9.5 muted2 |
| Logout button | colors.red border + colors.red text | 1.5px dangerPale border + dangerText sansBold |

## Behavior delta — zero behavioral change

| Behavior | Status |
|---|---|
| getMe load + listing_data flatten on mount | Preserved verbatim |
| useContext(AuthContext) for setRole | Preserved |
| Diff-based save: only mutated top-level fields posted | Preserved verbatim |
| listing_data serialized string-diff before posting | Preserved verbatim |
| listing_data shape: branches[0] = { name: 'Main Branch', ...mainBranch, phone: brand.phone } + extras_filtered | Preserved verbatim |
| extras filter: drops branches with empty name AND empty address | Preserved verbatim |
| businessName.trim() === '' → Alert "Missing info" | Preserved |
| All-equal payload → Alert "Nothing to save" | Preserved |
| Save success → Alert "Saved" + setBrand(updated) | Preserved |
| Save failure → Alert with res.error.message | Preserved |
| addBranch / updateBranch / removeBranch (Alert confirmation) | Preserved verbatim |
| GSTIN auto-uppercase + maxLength 15 | Preserved |
| Pincode numeric-only via regex + slice(0, 6) | Preserved verbatim |
| Phone + Category read-only inputs | Preserved |
| KeyboardAvoidingView with iOS padding | Preserved |
| Other links: openWebDashboard / nav('Notifications' / 'MediaGallery' / 'ProposalInbox') | Preserved verbatim |
| Logout: Alert + clearSession + setAppRole('') | Preserved verbatim |

## Adjacent-fix observation
The original screen renders `colors.t3` and `colors.t2` consistently but uses raw hex `#92400E` and `#991B1B` for status banner text — Flow 24 brings these into the brandPalette family (yellowText / dangerText) for consistency. Strictly a palette migration, not a UI behaviour change.

## Wave-3 follower regression check
theme/tokens.js unchanged. 24 Wave-3 follower screens byte-identical.

## QA classification expectation
Per Flow 19/21/23 precedent: env-flake clusters (MSG91 throttle + Render cold-start hydration timeout) likely on first run. Mitigation: pre-warm backend, retry, classify. Flow 24 touched 1 mobile file — zero web/backend/qa changes — zero causal path to brand-web or API failures.

## What's NOT in this flow
- Logo file upload (still URL-only per existing copy + impl)
- Bank details editing (Flow 26 — Wallet)
- Component extraction for Field / Card / Branch box (single use here; defer until 2+ form screens emerge)
- BankDetailsForm reusable (deferred to Flow 26)
