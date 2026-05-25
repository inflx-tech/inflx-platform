# Flow 14 · expected outputs — what the user sees per state

These outputs map 1:1 to the 3 states in `04-preview/mockups/web.html`.

---

## State 1 · Approved brand · filled form

- Settings layout (Window A's) renders "Settings" H1 + 3 tabs (Profile active) above
- Profile content area starts below tab nav:
  - No status banner (approved status hidden)
  - **Brand Logo card**:
    - 80px yellow-pale square with initials (or `<img>` from logo_url with `onError` fallback to initials)
    - Logo URL input (palette focus)
    - "Direct image URL for your business logo" mono help text + "Upload File" tooltip-link
  - **Business Information card**:
    - Business Name (required, palette focus)
    - Contact Person
    - 2-col grid: Phone (mono, locked, 🔒 label) + Category (locked, 🔒 label) with help text
    - GSTIN (mono, 15 char max)
    - Save row: mono "Last updated · {fmtDateTime}" left + ink+yellow "Save Changes" right
  - **Branches & Outlets card**:
    - Header with "+ Add Branch" yellow-ghost button right-aligned
    - Main Branch sub-card with success-pale tint (top gradient) + "Primary" success pill
      - All fields per spec: Country (locked) · State select · City · Pincode (mono) · Full Address textarea · Google Maps URL · Phone (locked, inherited)
    - Additional Branch sub-card(s) with "Remove" danger-text link
      - All fields per spec
  - **Account Details card**:
    - 4-cell mono grid: Registered (date) · Approved On (date, when present) · Brand ID (truncated to 12 chars + ellipsis, NEW) · Status (with success dot when approved)

## State 2 · Pending brand · empty form

- Same layout as State 1 with these differences:
  - **Yellow-pale status banner at top**:
    - `!` icon in yellow circle (32px)
    - "Pending" bold + " — Your account is under review. You'll be notified once approved..."
  - Logo thumb shows dashed border + "No logo" mono
  - All form inputs empty (showing placeholders)
  - Save row "Last updated · Never"
  - Toast example shown: "✓ Profile updated successfully" ink toast bottom-right

## State 3 · Rejected brand · with reason

- Same layout as State 1 with these differences:
  - **Danger-pale status banner at top**:
    - `✕` icon in danger circle (32px)
    - "Rejected" bold + " — Your account was not approved."
    - Sub-line: "Reason: {brand.rejection_reason}" in muted mono
  - Form populated (rejected brands can fix and re-submit)
  - No additional branches → "No additional branches · click '+ Add Branch' to add one" mono hint below Main Branch

---

## Cross-state invariants

- Locked palette is the only color source (no `bg-gold`, `text-t1`, `border-border2`, etc.)
- All numbers / phone / pincode / GSTIN / dates / Brand ID in JetBrains Mono
- All inputs use palette focus ring (yellow border + yellow-pale halo)
- Read-only inputs locked: bg2 background + muted text + 🔒 label tag + non-clickable
- Required fields marked with red `*` in label
- Help text in mono, smaller, muted-2 color
- Save button always visible at bottom of Business Info card (per OLD behavior — single save covers all fields)
- Main Branch always at top of branches stack
- Empty additional-branches hint only shown when zero additional branches
- Toast slides in from bottom-right, auto-dismisses after 3500ms
- Loading state: locked-palette spinner centered
- Not-found state: simple error card with "Brand profile not found. Please complete registration first."
- All CSS scoped under `.prf` wrapper; layout's `.shub` rules unaffected
- Settings tab nav (Window A's) renders unchanged above the profile content
