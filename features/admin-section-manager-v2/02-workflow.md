# Workflow — admin-section-manager-v2 (Part A)

## Admin flow (`/admin/sections`)
1. Admin picks a **screen** (Home/Category/Offers/Creator Store/Creator's Category)
   and a **scope** (Global, or City + name, or Vertical + key) → shelves load.
2. Per shelf: **edit the title inline**; expand **Edit details** to set the caption
   (`sub`), chip/filter labels, nav-vertical labels+icons, or raw config JSON;
   reorder ▲▼; show/hide; count ±; category/item-type; delete ✕.
3. **＋ Add Section** → choose a preset → a new draft shelf appears at the end.
4. **Publish** → `PUT /admin/sections/:screen` with the scope + shelves. New shelves
   (no id) insert; existing update. Live in the follower app within ~60s.

## Build (Part A)
1. Rebuild `app/admin/sections/page.js`: scope selector, inline title edit, config
   editor (caption / labels / verticals / advanced JSON), Add-Section presets.
2. `pnpm qa` GREEN (admin nav/role-gate specs unaffected).
3. `06-diff/notes.md` vs the admin panels in the comprehensive mockups.
4. Push → Vercel auto-deploys brand-web. (No OTA; no migration.)

## Part B (follow-up)
Greeting → home `header` shelf (migration 091) + app reads it; sub-cat chips
admin-curated (config + app read). Migration + OTA, surfaced for go.

## End state (Part A)
Admin can rename shelves, edit captions/labels/verticals, add sections, and scope
per city/vertical — all live within ~60s, no app update.
