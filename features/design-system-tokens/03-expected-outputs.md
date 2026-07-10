# Expected Outputs — Design System & Tokens (Phase 1)

## API: GET /v1/admin/design-system/tokens?world_key=fashion
```json
{
  "success": true,
  "data": {
    "tokens": {
      "mood":       [{ "key": "urban", "label": "Urban", "config": { "descriptor": "…" } }, "… 8 total"],
      "palette":    [{ "key": "urban_dark", "label": "Urban Dark",
                       "config": { "primary": "#26262A", "secondary": "#5F5E5A",
                                   "accent": "#FFC400", "bg": "#1C1C1E", "text": "#FFFFFF" } }, "… 6 total"],
      "typography": [{ "key": "bold_fashion", "label": "Bold Fashion",
                       "config": { "family": "Inter", "weight": 800, "spacing": "-0.02em" } }, "… 6 total"],
      "background": [{ "key": "urban_concrete", "label": "Urban Concrete",
                       "config": { "type": "texture", "avg_color": "#3a3a3d",
                                   "asset_r2_key": null, "text_safe_zone": "bottom-left" } }, "… 16 total"],
      "radius":     [{ "key": "soft", "label": "Soft", "config": { "px": 12 } }, "… 3 total"],
      "shadow":     [{ "key": "soft", "label": "Soft", "config": {} }, "… 3 total"]
    }
  },
  "meta": { "world_key": "fashion" }
}
```
Rules: world tokens merged over global (world wins on same key). `asset_r2_key` may be `null` until the design-asset workstream ships the file.

## API: GET /v1/admin/design-system/presets?world_key=fashion
```json
{
  "success": true,
  "data": {
    "presets": [
      { "key": "urban_fashion", "label": "Urban Fashion",
        "tokens": { "mood": "urban", "palette": "urban_dark", "typography": "bold_fashion",
                    "background": "urban_concrete", "radius": "soft", "shadow": "soft" },
        "positions": { "avatar": "top-left", "featured": "right", "cta": "bottom-left" } },
      "… 8 total"
    ]
  }
}
```

## Screen states
- **Loaded:** five labelled groups; counts match seed.
- **Empty (pre-seed):** each group shows a muted empty-state; no error toast.
- **Forbidden:** redirect/deny per existing admin-auth pattern.

## Non-goals (must NOT appear)
- No create/edit/delete controls (read-only v1).
- No theme/template/render surfaces.
- No mobile or follower changes.
