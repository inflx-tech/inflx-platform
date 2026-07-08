# Impact — category-images

**Verdict: additive; no migration; placeholder fallback keeps everything safe.**

- Backend: two SELECTs gain `meta->>'image_url'`; one new admin PATCH. No schema
  change (uses existing meta jsonb).
- brand-web: new admin page + one nav entry.
- Mobile: rail + tiles render image when present, else the existing placeholder.
- Production-impacting: Render (backend) + Vercel (brand-web) + mobile OTA.
- Rollback: revert one commit; images become dormant meta, UI falls back to
  placeholders.
