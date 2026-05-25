# Expected Outputs — Flow 24

## Hero
- Ink bg padding-top 52
- 72×72 yellow circle avatar with 2-char ink Outfit initials
- Outfit-Bold 20 white brand name
- `<StatusPill status={user_status} />` below name (canonical: approved → successPale "APPROVED", pending → bg2/muted2 "PENDING", rejected → dangerPale "REJECTED")

## Status banner (pending / rejected only)
- Pending: yellowPale bg + yellowPale border + yellowText title "Account pending review" + sub copy
- Rejected: dangerPale bg + dangerPale border + dangerText title "Account not approved" + rejection_reason sub

## Business Info card
- Field label: monoBold 10 muted uppercase letterSpacing 0.4
- Input: PJS Medium 13 ink, 1.5px border, white bg, 10 radius
- Read-only input: bg2 + muted3 text (Phone, Category)
- Hint: PJS 10 muted2

## Main Branch card
- Title row: Outfit-Bold 14 ink + "Primary" chip (successPale bg + successText fg + mono 9.5 uppercase)
- Same field stack as Business Info

## Additional Branches card
- Title row: Outfit-Bold "Additional Branches" + "+ Add Branch" button (yellow border + yellowText sansBold pill)
- Empty: PJS muted center "No additional branches. Tap "+ Add Branch" to add one."
- Per-branch box: border-radius 12 + 1px border, with "Branch N" mono uppercase label + Remove link (dangerText sansBold)

## Save Changes button
- Yellow bg + ink Outfit-Bold "Save Changes"
- ActivityIndicator (ink) when saving

## Other links card
- 4 link rows with mono [W]/[N]/[G]/[P] icon + sansBold ink label + mono chevron
- Hint sub-line below Web Dashboard row

## Logout button
- White bg + 1.5px dangerPale border + dangerText sansBold

## Data assertions
- updateMe payload includes only mutated top-level fields (business_name, gstin, logo_url, address_line, pincode) + listing_data when listing_data string-diff
- listing_data on save = { contact_person_name, branches: [{ name: 'Main Branch', ...mainBranch }, ...extras_filtered] }
- Diff filter for extras: branch with empty name AND empty address dropped
- pincode validation: numeric-only, max 6 digits (per regex replace)
- GSTIN: auto-uppercase, max 15 chars

## Visual evidence
`design/wave2/flow-24-brand-mobile-profile/web.html` — 1 phone frame at 375px showing all 3 cards + Save + Other links + Logout
