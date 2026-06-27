# 06 — Before / after notes

**Before** = the redesign mock `04-preview/mockups/app-builder-preview.html`.

**After** = the live App Builder: kind tags on every section, grouped/pruned Add-section
menu, Frame rule create-or-saved + save-for-reuse, the right-side live mobile preview, and
the category "All" tile. Capture pending the Vercel admin deploy + founder live-test.

## What the implementation delivers vs the mock
- NO RULE / NEEDS A RULE tags via `sectionKind()` — matches.
- Add-section optgroups (Data / Frame / Controls) + world/biz gating; one "Image / banner
  frame"; Library Section + duplicate creators removed; food rail relabelled — matches.
- Frame banner: Create / Use-saved toggle + Save-for-reuse (`adminApi.createSectionLibrary`)
  — matches; Section Library nav link removed.
- `MobilePreview`/`PreviewSection`: phone frame rendering categories (+ All) and banner
  images faithfully, placeholders for auto rails — matches.
- Backend `categoryNodes` appends the "All" tile.

## Verification
- backend load ok · brand-web `npm run build` exit 0 · `pnpm qa` GREEN 79.
- No mobile change → no OTA. Live founder test on Vercel admin = final sign-off.
