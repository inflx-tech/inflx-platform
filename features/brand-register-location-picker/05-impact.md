# Impact — registration location picker

**Verdict: additive feature — manual registration byte-identical; search/link modes start filling the discovery coordinates every new brand was silently missing.**

- Frontend: brand-web login page only (Vercel deploy; no mobile/OTA impact).
- Backend: register accepts optional fields (all-optional → existing clients
  unaffected); places details gains two additive response keys; no migration
  (all columns exist since 015/051).
- Reuses the restaurant-wizard maps resolver and follower Places proxy —
  no new external API surface, same server-side key handling, same
  autocomplete+details session billing pattern.
- Risk surface: register INSERT gains 6 columns — covered by qa regression +
  journey driver S1.2 (registers a brand) which must stay green.
