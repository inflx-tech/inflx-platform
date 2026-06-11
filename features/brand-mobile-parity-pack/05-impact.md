# Impact — brand mobile parity pack

**Verdict: additive mobile-only build — six new screens on existing endpoints; zero backend change, zero web change, existing mobile screens untouched except the Home quick-actions grid.**

- Deploys via OTA only (pure JS; no APK rebuild, no Render/Vercel impact).
- Every screen consumes endpoints the web dashboard already exercises in prod
  daily — no new API surface, no new permissions (all behind brand JWT).
- Vertical gating honoured: Meals self-gates on brand.category==='restaurant'
  (defense at nav level; the /meals/* API keeps its own backend gate).
- Founder's web-only exclusions intact: no listing, no campaign creation.
- Known v1 link-outs (recorded in spec): plan upgrade → web; complex offer
  builders → web; meals chat-builder → web.
