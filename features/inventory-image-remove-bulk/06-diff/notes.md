# Before / after
- Before: DefaultFleetRow showed {icon} (no image); getMyNodeProducts returned
  is_active=false products (removed rows lingered → "Remove not working"); no
  bulk delete.
- After: row renders product.image_url (icon fallback) + optional checkbox;
  getMyNodeProducts filters is_active=true (removed rows drop on refetch);
  DrilldownFleetView adds select-all + sticky bulk-delete bar (loops DELETE).
  node --check + esbuild clean; pnpm qa GREEN. Backend + web, no OTA.
