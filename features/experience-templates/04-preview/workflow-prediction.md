# Workflow Prediction — Experience Templates (Phase 5)

Predicted click-path the mockups demonstrate (confirmed against the real screens in the 06-diff step).

## Screen 1 — Templates list (`templates-list.html`)
1. `/admin/experience-templates`, world = Fashion.
2. Header + **Create Template**.
3. Grid of template cards: name, theme + design + section-style chips, type tag (Creator/Automatic/Mixed), Draft/Placed pill.
4. Empty → "No templates yet — assemble one from a theme + design."

## Screen 2 — Template builder (`template-builder.html`)
Assembling "Street Style Hero" — each choice reads from live libraries:
1. **Type** — Creator (chip); Automatic drops creator slots; Mixed adds an offer badge.
2. **Theme** — pick Street Style (from live themes).
3. **Design** — pick Hero Banner (from live layouts; its contract shown).
4. **Section Style** — pick Hero (from the vocabulary).
5. Name auto-suggests "Street Style Hero".
6. **Placement** — Fashion Home (+ optional audiences / creator store / business).
7. **Store rule** — if-products.
8. **Creator-store rule** — if-creator-has-experience.
9. **Location priority** — city → state → country → global.
Footer: **Save draft** + **Place** (place writes the section_config row).

Expected: after Place, the template shows "Placed" — but a note reminds the admin it renders empty on the follower home until creators publish experiences (Phase 6). The live home does not change today.
