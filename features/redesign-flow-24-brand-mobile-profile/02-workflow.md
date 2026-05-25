# Workflow Definition — Flow 24

## Actor
Logged-in brand on mobile app, reaches Profile from bottom-tab or Home.

## Preconditions
- Brand profile exists (registration complete)
- listing_data may be partially populated

## Workflow steps

1. Mount: getMe loads brand. Loading → centered yellow ActivityIndicator (no header during load).
2. Hero: ink bg + 72×72 yellow avatar circle with ink initials (Outfit) + Outfit-Bold brand name + `<StatusPill status={user_status} />` below.
3. (If status !== approved) Status banner card: yellowPale strip for pending / dangerPale for rejected, with title + sub copy (rejection_reason if present).
4. **Business Information card**: 6 fields:
   - Business Name * (required)
   - Contact Person
   - Phone (read-only, from auth)
   - Category (read-only, locked post-registration)
   - GSTIN (auto-uppercase, max 15)
   - Logo URL (URL keyboard)
5. **Main Branch card** with "Primary" chip (successPale + successText): state, city, pincode (numeric 6), full address (textarea), Google Maps URL.
6. **Additional Branches card**: "+ Add Branch" button (yellow ghost). Empty state copy if zero. Per-branch box with branch name, state, city, pincode, address, phone, google maps URL + Remove (dangerText link, Alert confirmation).
7. Save Changes button (yellow + ink Outfit-Bold). Validates businessName required. Diffs against initial state; posts only changed fields. Alert "Nothing to save" / "Saved" / "Save failed".
8. **Other card**: 4 link rows (Open Web Dashboard, Notifications, Media Gallery, Influencer Proposals) with mono icon placeholders + sansBold labels + mono chevron.
9. Logout button (white + danger border + danger text). Alert confirmation → clearSession + setAppRole('').

## Success
- All fields render with brandPalette + fonts
- Diff-save still produces correct payload shape (verified via existing updateMe expectations)
- Branch list CRUD works (add / edit / remove with confirmation)
- Logout flow exits to login screen
- Status pill reflects user_status via canonical map (approved → successPale "APPROVED", pending → yellowPale "PENDING" — uses canonical "PENDING" label override; rejected → dangerPale "REJECTED")

## Failure / edge
- getMe failure → Alert + screen stays on loading state (preserved)
- updateMe failure → Alert with res.error.message; form state retained
- Empty branch (no name + no address) → silently dropped on save (preserved filter)
- Logout cancellation → no-op
