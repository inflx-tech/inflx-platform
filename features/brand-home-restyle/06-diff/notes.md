# Before / After — brand Home restyle (quick actions)

**Before:** 11 quick-actions with a **mixed emoji + glyph** icon set (🧾 📅 🏷 📊 🤝 next to
⊟ ◫ ✉ ₹ ★ ⚙) rendered as text on **30px solid-yellow circles** — three different visual
languages in one grid, and inconsistent with the IG-clean tab bar shipped in v160.

**After:** all 11 use **MCI vector icons** (receipt / calendar / tag / bullhorn / wallet /
email / rupee / account-search / chart / cog / handshake) on a **neutral 38px rounded tile**,
label bumped 11 -> 12px in the IG ink colour. Navigation targets untouched.

## Changed
- `BrandHomeScreen.js` — QUICK_ACTIONS icon names, the icon render, quickIcon +
  quickLabel styles; removed the now-unused quickIconGlyph style.

## Verification
- Mobile jest **105/105 green** (+1 new smoke suite); no dangling style refs.

## Known delta
- Only the quick-action grid is restyled here. The Home hero, action-required card, wallet
  alert and campaign cards still use the old palette — deliberate, so each slice stays small
  and reviewable.
