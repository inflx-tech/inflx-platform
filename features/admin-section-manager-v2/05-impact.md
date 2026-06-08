# Impact — admin-section-manager-v2 (Part A)

**Verdict: admin-only UI upgrade to the Section Manager. One brand-web file. No
backend/migration change. Follower-facing only via data the admin chooses to
publish.**

## Mechanics
- `app/admin/sections/page.js` gains scope selector + title edit + config editor +
  Add-Section. All write through the EXISTING `/v1/admin/sections` save (which
  already supports title/config_json/insert/scope). Publish busts the 60s cache.

## Risk
- **Low, admin-only.** A bad admin edit could mis-shape a shelf, but: the raw-JSON
  editor validates before apply; the backend `validateShelf` rejects invalid
  shelf_type/rule/limit/position; the engine swallows a broken shelf ([] → empty,
  never 500); Publish is reversible (re-edit / delete). Web QA (admin nav/role-gate)
  unaffected — those test reachability/auth, not this page's internals.
- Reversible: revert the file (Vercel redeploys); re-publish corrected config.

## Deploy
- **production-impacting** (Vercel brand-web). Auto on push. No migration, no OTA.
  Part B (greeting/chips) is a separate migration + OTA, surfaced for go.
