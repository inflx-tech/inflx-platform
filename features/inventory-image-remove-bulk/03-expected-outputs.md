# Expected outputs
- Rows render product.image_url (fallback icon). Remove drops the row (backend
  now filters is_active=true). Bulk: select N → delete → gone.
- node --check (backend) + esbuild JSX (ListingTemplateLayout) clean.
- pnpm qa GREEN gate 0. No migration, no OTA.
