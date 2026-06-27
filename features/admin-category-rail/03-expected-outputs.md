# 03 — Expected outputs

## Stored section row (config_json)
```json
{
  "shelf_type": "nav_tiles",
  "rule": "category_nodes",
  "config_json": {
    "nodes": [
      { "category_node_id": "…uuid…", "vertical": "fashion", "label": "Jeans", "icon": "" },
      { "category_node_id": "…uuid…", "vertical": "fashion", "label": "Footwear", "icon": "👟" }
    ]
  }
}
```

## Section-engine emitted items (rule `category_nodes`)
```json
[
  { "entity_type": "category", "key": "…uuid…", "label": "Jeans",
    "icon": null, "category_node_id": "…uuid…", "vertical": "fashion" }
]
```

## Mobile
- Rail renders the picked categories (label + optional icon).
- Tap → `CategoryBrowser` with `{ nodeId: category_node_id, vertical, title: label }`.
- World nav tiles (rule `nav_verticals`, no node id) unchanged → still route to CategoryList/Find.
