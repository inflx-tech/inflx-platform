# Flow 14 · brand-web settings/profile — spec

**Slug:** `redesign-flow-14-brand-web-profile`
**Status:** locked (mockup approved 2026-05-25)
**Wave:** wave2 redesign (palette · scoped CSS · backend-first)

---

## What this flow restyles

**Single isolated form page.**

| Route | File | LOC OLD |
|---|---|---:|
| `/dashboard/settings/profile` | `page.js` | 603 |

Restyles the brand's settings-profile form (business info · main branch · additional branches · account details).

---

## Critical scope clarity

The handoff §11 originally listed `/dashboard/profile (603 LOC)` — that file is now a 6-LOC server redirect to `/dashboard/settings/profile` (moved by Window A's Phase A9 Settings hub consolidation).

**Flow 14 touches:**
- ✅ `Packages/brand-web/app/dashboard/settings/profile/page.js` — full rewrite

**Flow 14 does NOT touch:**
- ❌ `Packages/brand-web/app/dashboard/settings/layout.js` (Window A's Phase A9 hub shell — already palette-aligned with `#0A0A0A`/`#FAFAFA`/`#E4E4E7`/`#52525B`; tab underline pattern preserved)
- ❌ `Packages/brand-web/app/dashboard/settings/subscription/page.js` (Window A's Phase A7-brand)
- ❌ `Packages/brand-web/app/dashboard/settings/billing/page.js` (Window A's Phase A7-brand)
- ❌ `Packages/brand-web/app/dashboard/profile/page.js` (the 6-LOC redirect — preserved)

---

## Backend audit — every visible field traces

**Endpoint 1 · `GET /brands/me`** → `brandApi.getMe()`
Returns `{ brand }` (or `data` directly) with these fields used:
- `business_name` (top-level write)
- `category` (read-only display — cannot be changed after registration)
- `gstin` (top-level write)
- `logo_url` (top-level write)
- `phone` (read-only — linked to login)
- `name` (fallback for contact_person when listing_data missing)
- `address_line` (top-level write — flattened from Main Branch address)
- `pincode` (top-level write — flattened from Main Branch pincode)
- `user_status` (or fallback `status`) — drives banner visibility
- `rejection_reason` (displayed in rejected banner)
- `created_at` (Account Details card)
- `updated_at` (Save row "Last updated" timestamp)
- `approved_at` (Account Details card, only when present)
- `id` — **NEW surface** in Account Details (truncated to 12 chars + ellipsis)
- `listing_data` (object) containing:
  - `contact_person_name`
  - `branches[]` array where each branch has `{ name, state, city, pincode, address, phone, google_maps_url }`. "Main Branch" entry identified by `name === 'Main Branch'`; everything else is Additional Branches.

**Endpoint 2 · `PATCH /brands/me`** → `brandApi.updateMe(payload)`
Payload shape (preserved verbatim):
- `business_name?`, `gstin?`, `logo_url?` — top-level fields
- `address_line?`, `pincode?` — backward-compat flat fields, sourced from Main Branch's address+pincode
- `listing_data?` — full replacement when any branch / contact_person changes; preserves existing keys via spread

Diff logic preserved: only changed fields are sent. JSON-compare for `listing_data` (deep equality via stringify).

## Verified — no phantom fields, no API contract changes

- No new endpoint
- No new query param
- No new field consumed (Brand ID is from existing `brand.id`)
- No payload shape change

---

## Scope (in-scope)

### Layout structure (single column max-w-920px, wrapped in `.prf`)

1. **Status banner** (conditional — only when `user_status === 'pending'` OR `'rejected'`)
   - `pending` = yellow-pale bg, yellow border, ink-on-yellow icon
   - `rejected` = danger-pale bg, danger border, white-on-danger icon + `rejection_reason` sub-line
   - approved = no banner (existing behavior preserved)

2. **Brand Logo card**
   - 80px square logo thumb: dashed border + "No logo" mono text when empty · solid yellow-pale + initials when present (or `<img>` from `logo_url` with error fallback)
   - Logo URL input (palette focus ring) + "Upload File" tooltip preserved

3. **Business Information card**
   - 5 fields stacked: Business Name (required) · Contact Person · Phone (read-only, mono, 🔒 locked) · Category (read-only, 🔒 locked) · GSTIN (mono, 15 char max, auto-uppercase)
   - Phone + Category in a 2-col grid (more compact)
   - Save row: mono "Last updated · {date}" left + ink+yellow "Save Changes" button right

4. **Branches & Outlets card**
   - Header with "+ Add Branch" yellow-ghost button
   - **Main Branch** sub-card with `success-pale` tint at top (distinguishing from additional branches) + "Primary" success pill
     - Fields: Country (locked = "India") · State select (28 states + 8 UTs) · City · Pincode (mono, 6-digit, numeric) · Full Address textarea · Google Maps URL · Phone (read-only, inherited from profile)
   - **Additional Branches** stack (each removable)
     - Fields: Branch Name · State · City · Pincode (mono) · Address · Phone + Google Maps URL (2-col)
     - "Remove" danger-text text link
   - Empty state hint when no additional branches

5. **Account Details card**
   - 4-cell mono grid: Registered · Approved On (only when present) · Brand ID (truncated, NEW surface) · Status (with palette dot)

6. **Toast** (bottom-right): ink for success / danger for error · auto-dismiss after 3.5s · matches Flows 11-13 pattern

### Behavior preservation

- All form state management preserved
- Payload diff logic preserved (only send changed fields)
- "No changes to save" early-return preserved
- Business name required validation preserved
- GSTIN auto-uppercase preserved
- Pincode 6-digit numeric-only preserved
- Branch array manipulation (add/update/remove) preserved
- Main Branch identified by `name === 'Main Branch'` preserved
- Save success/error toast preserved

### Cross-cutting

- All numbers / phone / pincode / GSTIN / dates / IDs in JetBrains Mono
- CSS scoping discipline from day 1 under `.prf` wrapper
- Read-only inputs locked with palette bg + muted color + 🔒 label tag

## Out of scope

- Settings layout / hub chrome (Window A's territory)
- Subscription page (Window A's territory)
- Billing page (Window A's territory)
- Backend `GET /brands/me` or `PATCH /brands/me` changes
- File upload integration (placeholder "Upload File" tooltip preserved — backend R2 upload integration is a separate flow)
- Phone number change (intentionally locked — login-linked)
- Category change (intentionally locked after registration)
- Add additional branch validation (preserved as-is — no schema enforcement on additional branch shape)
