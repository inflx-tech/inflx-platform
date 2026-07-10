# Workflow Prediction — Theme Library (Phase 2)

Predicted click-path the mockups demonstrate (confirmed against the real screens in the 06-diff step).

## Screen 1 — Theme Library (`themes-list.html`)
1. Admin lands on `/admin/themes`, world = Fashion.
2. Header "Theme Library — Fashion World" + **Create Theme** button.
3. Grid of authored theme cards: icon, name, purpose tag, preset chip, status pill (Draft/Published), product-range.
4. Empty on first run → "No themes yet — start from a blueprint."
5. **Create Theme** → Blueprint picker (cards grouped by purpose: Lifestyle / Occasion / Travel / Budget / Category / Trend).

## Screen 2 — Theme Configuration wizard (`theme-wizard.html`)
Started from the **Street Style** blueprint — every field pre-filled; admin edits the delta.
1. **Identity** — name, subtitle, icon, audience, visibility.
2. **Purpose** — Lifestyle (chip selected).
3. **Visual** — preset **Urban Fashion** (Phase-1 preset card shown; admin can swap preset).
4. **Supported Categories** — checkboxes from the world's categories (Jeans/Sneakers/Caps pre-checked).
5. **Product Count** — min 4 / max 20.
6. **Media Rules** — featured required · video optional · portrait preferred.
7. **Supported Offers** — discount / bundle / bogo / free_gift (checked); flash-sale unchecked for e.g. Wedding.
8. **Suggested Products** — optional hints.
9. **Default Copy** — title / subtitle / CTA.
10. **Applicable Worlds** — Fashion checked.
Footer: **Save draft** + **Publish** (publish shows inline validation if a required field is missing).

Expected: a non-designer fills nothing from scratch — they pick a blueprint and adjust. Publishing a theme with no supported category is blocked with an inline reason.
