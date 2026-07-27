# Impact — A2
**Frontend-only, brand-web (Vercel) — zero backend.**
- Adds reviewParts.js; hub imports MediaPreview (deletes inline copy); removes 2 cross-links.
- reviews/page.js → redirect (route retired; its MediaPreview copy gone).
- Reuses existing inline review handlers — no action logic changes.
Risk: low — review already worked inline; this removes the duplicate route + dupe component.
Release: production-impacting via Vercel → founder go; web verify on deployed dashboard.
