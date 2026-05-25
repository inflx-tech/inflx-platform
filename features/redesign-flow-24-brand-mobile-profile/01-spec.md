# Feature Spec — Flow 24 · brand-mobile Profile

## Problem / goal

Seventh flow. BrandProfileScreen (541 LOC) — form-heavy single screen for editing brand profile + branches + quick links. Currently navy + orange legacy. Migrate to brandPalette + Flow 21 components + Outfit/PJS/JetBrains-Mono.

## Scope

**In scope:**
- Visual rewrite consuming brandPalette + StatusPill + fonts (no ScreenHeader — this screen has a custom hero with avatar)
- Replace inline status chip (approved/pending) → `<StatusPill status={brand.user_status} />`
- Replace inline status banner (pending → warn / rejected → error) with brandPalette-tinted strip
- Preserve all behavior 1:1: diff-based save (only mutated fields posted), listing_data shape (branches[0] = Main Branch + extras), branch list CRUD with Alert confirmation on Remove, AuthContext logout flow, openWebDashboard for web link

**Out of scope:**
- `theme/tokens.js` changes
- Backend / API changes
- Logo file upload (still URL-only per existing copy)
- Bank details (those live in BrandWalletScreen — Flow 26)
- Categories editing (still locked post-registration)

## Surfaces touched
- mobile-brand: 1 screen file

## Data / contracts
- **APIs**: getMe (returns brand + listing_data), updateMe (diff-based payload) — both unchanged
- **listing_data shape**: `{ contact_person_name, branches: [{ name: 'Main Branch', state, city, pincode, address, phone, google_maps_url }, ...extras] }` — preserved
- **Status enum**: user_status / status = approved | pending | rejected → StatusPill via canonical map (already absorbed)

## Non-functional
- Auth: AuthContext available via `useContext(AuthContext)`; logout via `clearSession()` then `setAppRole('')`
- KeyboardAvoidingView for form inputs preserved
- Validation: businessName required; pincode numeric-only 6-digit; phone read-only; category read-only
