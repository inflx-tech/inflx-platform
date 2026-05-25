# Flow 14 · preview workflow-prediction — mockup → backend source mapping

Verifies every visible element in `04-preview/mockups/web.html` traces to a real backend field shipped today.

---

## State 1 — Approved brand · filled form

| Element | Backend source |
|---|---|
| Logo thumb image | `brand.logo_url` (with `<img onError>` fallback to initials) |
| Logo initials fallback | first 2 chars of `brand.business_name` (uppercase, or `🏢` if empty) |
| Logo URL input | `brand.logo_url` |
| Business Name input | `brand.business_name` |
| Contact Person input | `brand.listing_data?.contact_person_name` (fallback `brand.name`) |
| Phone (locked) | `brand.phone` |
| Category (locked) | `brand.category` |
| GSTIN input | `brand.gstin` |
| Save "Last updated · {date}" | `brand.updated_at` formatted via `toLocaleString('en-IN')` |
| Main Branch · State | `brand.listing_data?.branches[?(@.name='Main Branch')]?.state` (fallback empty) |
| Main Branch · City | `brand.listing_data?.branches[?(@.name='Main Branch')]?.city` (fallback empty) |
| Main Branch · Pincode | `brand.listing_data?.branches[?(@.name='Main Branch')]?.pincode` (fallback `brand.pincode`) |
| Main Branch · Address | `brand.listing_data?.branches[?(@.name='Main Branch')]?.address` (fallback `brand.address_line`) |
| Main Branch · Google Maps URL | `brand.listing_data?.branches[?(@.name='Main Branch')]?.google_maps_url` |
| Main Branch · Phone (locked) | `brand.phone` (inherited from profile) |
| Additional Branch · Name | `branch.name` |
| Additional Branch · State | `branch.state` |
| Additional Branch · City | `branch.city` |
| Additional Branch · Pincode | `branch.pincode` |
| Additional Branch · Address | `branch.address` |
| Additional Branch · Phone | `branch.phone` |
| Additional Branch · Google Maps URL | `branch.google_maps_url` |
| Account · Registered | `brand.created_at` |
| Account · Approved On | `brand.approved_at` (only when present) |
| Account · Brand ID | `brand.id` (truncated to 12 chars + ellipsis — NEW surface) |
| Account · Status | `brand.user_status || brand.status` (with success/yellow/danger dot per palette) |

## State 2 — Pending banner

| Element | Backend source |
|---|---|
| Status banner visibility | `userStatus === 'pending'` |
| Banner copy | static, hard-coded |

## State 3 — Rejected banner

| Element | Backend source |
|---|---|
| Status banner visibility | `userStatus === 'rejected'` |
| "Reason" sub-line | `brand.rejection_reason` (only when present) |

---

## PATCH payload mapping (preserved verbatim)

When brand clicks "Save Changes", the handler builds `payload` from form state:

| Form field | Payload key (when changed) |
|---|---|
| `form.business_name` | `payload.business_name` (trimmed) |
| `form.gstin` | `payload.gstin` (trimmed) |
| `form.logo_url` | `payload.logo_url` (trimmed) |
| `mainBranch.address` | `payload.address_line` (trimmed, flat for backward-compat) |
| `mainBranch.pincode` | `payload.pincode` (trimmed) |
| `contactName` change OR any branch change | `payload.listing_data = { ...existing, contact_person_name, branches: [Main first, ...additional] }` |

Diff logic preserved: only changed keys included; `listing_data` compared via JSON.stringify.

---

## Verification at impl time

```
grep -n 'brand\.\(business_name\|category\|gstin\|logo_url\|phone\|address_line\|pincode\|name\|user_status\|status\|rejection_reason\|created_at\|updated_at\|approved_at\|id\|listing_data\)' Packages/brand-web/app/dashboard/settings/profile/page.js
grep -n "name === 'Main Branch'" Packages/brand-web/app/dashboard/settings/profile/page.js
grep -n "brandApi\.\(getMe\|updateMe\)" Packages/brand-web/app/dashboard/settings/profile/page.js
```

Every match must correspond to a row in the tables above.
