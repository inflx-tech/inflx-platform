# 02 — Workflow
1. Verify refs (Collections, rule lookup degrades gracefully). 2. SHELF_TYPES fix.
3. top_by_sales alias + admin default. 4. Strip Collections from admin (page/nav/
preset/guard/editor/api). 5. Delete backend Collections (routes/controller/service)
+ sectionEngine expansion/import. 6. Verify: backend require OK, pnpm qa GREEN,
brand-web build exit 0. 7. Ship: commit (paths) → push (Render+Vercel auto-deploy).
End state: category-rail/tiles/restaurant-list sections SAVE; no Collections page;
no dead top_by_sales default.
