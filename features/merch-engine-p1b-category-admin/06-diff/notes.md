# Before / After — Follower Category admin (Phase 1b)

> UI-governed diff notes. Screenshot capture (Playwright before/after) runs in
> the dev env with brand-web built — recorded here in plain English meanwhile.

## Admin — Follower Categories (NEW screen)
- **Before:** the 7 follower tiles (Eat/Shop/Groom/Stay Fit/Travel/Home/Events) were hardcoded in `listing.service.js`; admin had no way to change them.
- **After:** `/admin/follower-categories` (under CONTENT in the nav) — a table of tiles showing icon / label / key / order / member businesses / status, with **Edit** (label, icon, sort order, member businesses, status), **Hide/Show**, and **+ Add tile**. Navy admin theme, matching Tag Vocabulary / Master Dishes / App Sections. Mockup: `04-preview/mockups/admin-follower-categories.html`.

## Backend — follower category read path (CHANGED, behaviour-preserving)
- **Before:** `getSuperCategories()` returned a hardcoded constant (sync).
- **After:** reads the new `follower_categories` table (active, by sort_order), **seeded identical to the constant**, and **falls back to the constant** if the table is empty/unreachable. Made async; the 3 follower call sites (`/follower/categories`, `/category/:super/stores`, search) now `await`. The legacy `getSuperCategories returns 7` unit test was updated to `await` the now-async function (same assertions).
- **Net follower-visible effect on deploy: none** (seed parity). Followers' category tiles are byte-identical until an admin edits.

## Verification
- Migration 100 applies clean in-chain (DB lane: migrations 99/99, 0 errors).
- `GET /follower/categories` + `/category/:super/stores` pass in the DB lane.
- brand-web production build exit 0.
- Web-lane `pnpm qa` green (admin web no regression).

## Fix-up (2026-06-14, prod-verify): Home carousel was a second source
- **Found in prod:** the follower **Home "Browse by Category" carousel** is fed by the section-engine `nav_verticals` rule from hardcoded `section_config.config_json.verticals` (labels Eat/Shop, keys dining/shopping) — a SEPARATE source 1b's `getSuperCategories` change didn't touch. So admin renames showed on the Categories screen but NOT the Home carousel.
- **Fix (backend-only):** `navVerticals` now reads `follower_categories` (active, by sort_order) with the legacy config as fallback → Home tiles use the admin labels + the table keys (eat/shop), which also fixes the old key mismatch (shopping/stay_fit tiles → 404 on the category endpoint). `adminFollowerCategories.controller` now `cache.clear()`s on write so edits reflect immediately. Mobile `CategoryListScreen` already accepts both `dining`/`eat`.
- **Still deferred:** `CategoryPills.js` (mobile) + section-engine `CATEGORY_MAP` are additional hardcoded category lists — full reconciliation stays in the Section-Library phase.

## What still needs capturing in dev env
- Playwright shots of the admin screen (7 seeded → add/hide/reorder).
- (Optional) a seed-parity snapshot assertion in QA.
