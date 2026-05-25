# Flow 13 · workflow — happy paths preserved

Pure restyle bundle (2 routes, 3 view modes on products, 3 tabs on gallery).
All brand happy paths run identically.

---

## Products page

### W1 · Brand lands on /dashboard/products

1. Page mounts; `useEffect` fires `brandApi.get('/brands/me/listing-config')`
2. If `listing_engine_active === true` → render `<ListingWizard />` from components (PRESERVED VERBATIM)
3. If `false` (or error) → `load()` fires `Promise.all([getSchema(), getProducts()])`
4. If `schema.features.master_catalogue === true` → also fire `getMasterCatalogue()`
5. Render appropriate view based on `isMasterCatalogue` flag

### W2 · Master catalogue view (car_rental / salon)

1. Top section "My Fleet/Services": activated items grid (image cards with Live/Hidden state)
2. Segment chips below: filter by segment (Hatchback/Sedan/etc. or salon category)
3. Master grid: non-activated items with `+ Add to Fleet` button
4. Click `+ Add to Fleet` → `ActivateModal` opens
5. Set price (+ optional duration packages for vehicles) → `createProduct({ master_vehicle_id OR master_service_id, name, section, price, image_url, is_bookable, variants_json?, duration_mins?, description })`
6. On success → toast "Added to your listing!" + `load()` refreshes catalogue
7. Click `Edit price` on activated item → `EditPriceModal` opens → `updateProduct(product_id, { price, variants_json? })`
8. Click `Remove` → confirm() → `deleteProduct(product_id)`

### W3 · Standard view (restaurant / fashion / other)

1. Section filter chips (from `schema.sections[]`)
2. Product row cards with veg/non-veg avatar, name + section tag, description + stock/variants meta, mono price, Live/Hidden pill, Edit/Hide/Del actions
3. Click `+ Add Dish/Product` button → `ProductFormModal` opens (mode=add)
4. Click row's `Edit` → modal opens (mode=edit)
5. Modal: dynamic field renderer over `schema.fields[]` (text/url/number/textarea/select/veg_toggle/duration_select/variant_builder)
6. Active toggle preserved
7. Submit → `createProduct(form)` or `updateProduct(id, form)`
8. On QuotaWall response → modal closes, QuotaWallModal opens (Window A's Phase A4 wall — preserved)
9. Click `Hide/Show` → `updateProduct(id, { is_active: !is_active })`
10. Click `Del` → confirm() → `deleteProduct(id)`

### W4 · Enquiry-only category

1. Render the existing blue notice card (preserved verbatim — restyled to info-pale palette)
2. Show "Add" button + product grid as normal (brands can still package enquiry forms)

## Gallery page

### W5 · Brand Assets tab (default)

1. `useEffect` fires `mediaGalleryApi.list()` + `mediaGalleryApi.getUsage()` in parallel
2. Render `UsageBar` with mono usage / quota / pct
3. Tag filter chips: clicking re-fires `mediaGalleryApi.list({ tag })`
4. Click upload dropzone or "+ Upload Asset" button → file picker
5. Drag-drop also works (`onDrop` → `handleFiles`)
6. For each file: `uploadFileToGallery(file, { title: file.name })` — preserved verbatim
7. On error → inline red error band; on success → `load()` refreshes grid
8. Click asset card → preserved (Open button) — opens `asset.download_url` in new tab
9. Click `Edit` → `EditAssetModal` opens → preserved field shape (title/description/tags)
10. Click `Del` → confirm() → `mediaGalleryApi.delete(id)`

### W6 · Reference Links tab

1. `useEffect` fires `referenceLinkApi.list()` once
2. Render row cards with platform-colored avatar (auto-detected from URL)
3. Click `+ Add Link` → `LinkModal` opens (mode=create)
4. Click row's `Edit` → `LinkModal` opens (mode=edit)
5. Submit → `referenceLinkApi.create({ url, title, description? })` or `update(id, body)`
6. Click `Open ↗` → opens URL in new tab
7. Click `Del` → confirm() → `referenceLinkApi.delete(id)`

### W7 · Contracts tab

1. `useEffect` fires `mediaGalleryApi.listContracts()` once
2. Search input + status filter select (client-side filter, preserved verbatim)
3. Render row cards: avatar (influencer initials) · campaign name + goal tag · @handle + signed date + deliverable summary · mono fee · status pill · View PDF
4. Click `View PDF` → `ContractPreviewModal` opens → `mediaGalleryApi.contractPdfUrl(id)` → render `<iframe src={url}>`
5. Modal Download button → opens `url` in new tab
6. Close modal restores list

---

## Mutation-preservation contract (frozen)

All mutations preserved verbatim:
- `createProduct(body)` body shape unchanged
- `updateProduct(id, body)` body shape unchanged
- `deleteProduct(id)` unchanged
- `mediaGalleryApi.delete(id)` unchanged
- `mediaGalleryApi.update(id, { title, description, tags })` body unchanged
- `referenceLinkApi.create({ url, title, description? })` body unchanged
- `referenceLinkApi.update(id, body)` body unchanged
- `uploadFileToGallery(file, { title })` helper unchanged

## Query-param contract (frozen)

- `mediaGalleryApi.list({ tag })` — when tag set, sends `?tag=<value>` exactly as today
- All other endpoints: no query params consumed

## Role / approval gates

- Both routes: brand authentication required (rely on layout's gate, no extra check in page.js)
- Listing engine feature flag (`listing_engine_active`) preserved as the dispatcher between standard products page and ListingWizard

## Listing engine pass-through

When `useListingWizard === true`:
```jsx
return (
  <div className="max-w-6xl mx-auto">
    <div className="mb-6">
      <h1 className="text-2xl font-black text-gray-900">Listing Setup</h1>
      <p className="text-sm text-gray-500 mt-1">Complete your store listing to attract followers</p>
    </div>
    <ListingWizard />
  </div>
);
```

This block is **preserved verbatim** (or lightly restyled to locked palette on the H1/sub only — no `.prd` wrapper, no CSS injection, no scoped restyling). The `<ListingWizard />` component itself is part of the spine and must not be touched.
