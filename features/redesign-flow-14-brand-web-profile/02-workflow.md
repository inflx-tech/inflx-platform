# Flow 14 · workflow — happy paths preserved

Single-route restyle. All form behaviors preserved verbatim.

---

## W1 · Brand lands on /dashboard/settings/profile

1. URL mounts inside Window A's Settings hub layout (renders "Settings" H1 + tabs)
2. Profile content area mounts inside layout's children slot
3. `useEffect` fires `brandApi.getMe()` once
4. On response: extract `brand` (or `data` fallback) — populate form state:
   - `business_name`, `category`, `gstin`, `logo_url` → top-level form
   - `listing_data.contact_person_name` (fallback to `brand.name`) → contactName
   - Find branch where `name === 'Main Branch'` → mainBranch state (state/city/pincode/address/google_maps_url; fall back to flat `pincode` + `address_line` when no listing_data branches)
   - All other branches → branches array

## W2 · Brand fills/edits Business Info + saves

1. Brand updates `business_name`, `contact_person_name`, `gstin`, or `logo_url`
2. Submit form (or click "Save Changes" button — same handler)
3. Validate: `business_name` required (non-empty after trim) → if missing, show error toast and return
4. Build `payload` with diff logic:
   - Compare each top-level field against `brand[field]`; include if changed
   - Compare `mainBranch.address`/`mainBranch.pincode` against `brand.address_line`/`brand.pincode`; include `address_line`/`pincode` if changed
   - Build new `listing_data` (spread existing + new contact_person_name + new branches array with Main Branch first)
   - JSON-stringify compare old vs new `listing_data`; include in payload if changed
5. If `Object.keys(payload).length === 0` → show "No changes to save" error toast, return
6. `PATCH /brands/me` with payload
7. On success → update local `brand` state with response · show success toast "Profile updated successfully"
8. On error → show error toast with `res.error.message` (fallback "Failed to update profile")

## W3 · Brand adds an additional branch

1. Click "+ Add Branch" yellow-ghost button
2. `setBranches(prev => [...prev, { ...EMPTY_BRANCH }])` — appends empty branch object
3. New branch card renders at the bottom of the stack
4. Brand fills branch name, state, city, pincode, address, phone, google_maps_url
5. Save handler picks up the new branch via the `branches` array

## W4 · Brand removes an additional branch

1. Click "Remove" danger-text link on a branch
2. `setBranches(prev => prev.filter((_, i) => i !== index))` — removes by index
3. Branch card disappears from stack
4. Save handler picks up the change via the `branches` array

## W5 · Pending brand sees status banner

1. Brand with `user_status === 'pending'` mounts page
2. Above the cards, yellow-pale banner renders:
   - `!` icon in yellow circle
   - "Pending" bold + " — Your account is under review..." copy
3. Form is fully functional; brand can fill profile while pending

## W6 · Rejected brand sees status banner + rejection reason

1. Brand with `user_status === 'rejected'` mounts page
2. Danger-pale banner renders:
   - `✕` icon in danger circle
   - "Rejected" bold + " — Your account was not approved." copy
   - If `brand.rejection_reason` present, render `<span class="reason">Reason: {rejection_reason}</span>`
3. Form is fully functional; brand can update details

## W7 · Brand has no logo URL set

1. Logo card renders with dashed border + "No logo" mono text in the 80px square
2. Input is empty; brand can paste URL
3. On URL input + Save → image renders in subsequent loads

## W8 · Logo URL fails to load (broken image)

1. Logo input has URL; `<img>` `onError` hides the img + shows the fallback initials
2. Fallback: 2-letter initials from business_name (or `🏢` emoji when business_name empty)

## W9 · First-time brand (no listing_data)

1. `brand.listing_data` is null or empty
2. Main Branch falls back to flat fields: `state=''`, `city=''`, `pincode=brand.pincode || ''`, `address=brand.address_line || ''`, `google_maps_url=''`
3. Branches array is empty → "No additional branches" empty hint shows below Main Branch card

## W10 · Loading and error states

1. While `loading=true`: render centered locked-palette spinner
2. If `getMe` returns `success=false` or no brand → render error card with "Brand profile not found. Please complete registration first."

---

## Mutation-preservation contract (frozen)

- `PATCH /brands/me` body keys: only ever `business_name`, `gstin`, `logo_url`, `address_line`, `pincode`, `listing_data`
- `listing_data` shape: `{ contact_person_name, branches: [{ name, state, city, pincode, address, phone, google_maps_url }] }` (Main Branch first)
- Branch with `name: 'Main Branch'` is the structured-address one; others are user-named additional branches
- "Main Branch" string literal must match exactly (backend treats it as Primary)
- Trim() applied to all string fields before send

## Query-param contract

None — page reads/writes only.

## Role / approval gates

- Brand authentication required (handled by Settings hub layout's gate)
- Page renders for any `user_status` (pending/approved/rejected/suspended)
- Form is editable for all statuses — backend may reject some updates based on status, but the UI doesn't pre-disable
