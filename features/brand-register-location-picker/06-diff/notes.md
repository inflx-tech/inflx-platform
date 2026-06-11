# Before/after — registration location section

**Mockup:** `04-preview/mockups/location-section.html` (3 cards = 3 modes).
**Implementation:** `Packages/brand-web/app/login/page.js` Location section.

- Mode pills (🔍 Search place / 🔗 Maps link / ✍️ Manual) render exactly as the
  mockup: amber border + cream fill on the active pill, locked palette tokens
  (#FFC107 / #FFFBEB / #E4E4E7 / #71717A) reused from the existing form.
- Search mode: suggestion dropdown is an absolute-positioned card under the
  input (mockup showed inline list; dropdown chosen so the form below doesn't
  jump). Top-5 predictions, main + secondary lines per mockup.
- "✓ Location captured" badge matches mockup (green pill) and appends the
  resolved locality.
- Maps-link mode: input + dark "📍 Locate" button per mockup, with the
  Share→Copy-link hint line.
- Manual mode: today's fields untouched; in ALL modes the address/city/
  pincode/state fields stay visible + editable below the helper (mockup
  showed the same).
- Backend deltas invisible in UI: register stores lat/lng + legacy pair +
  locality + formatted_address; places details adds state/pincode keys.

Verified by: scripts/test-register-location.js (4/4 — coords / maps-url /
manual / out-of-range), journey driver 27 PASS / 0 FAIL, pnpm qa (see
lock.json regression_proof).
