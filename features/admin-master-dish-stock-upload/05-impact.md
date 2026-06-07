# Impact — Admin stock-image upload

## Terse verdict
**Additive admin feature on the stable-URL foundation.** Admin can now upload free stock
images (not just paste URLs); permanent via the re-sign route. No migration. Seller/follower
paths unchanged (they already read `default_image_url`).

## Blast radius
- New admin endpoint (reviewer-gated) + new public prefix-guarded serve route. The serve
  route only reaches `stock/` keys → no path to brand assets or private contracts/KYC.
- brand-web change is confined to the master-dishes edit modal (upload button + preview);
  paste-URL preserved as fallback. Other admin pages untouched.

## Risk / rollback
- Revert restores paste-only. Upload failures surface inline; non-blocking.
- Mock mode: upload uses the multipart mock-POST branch (same as the gallery), so dev works.
