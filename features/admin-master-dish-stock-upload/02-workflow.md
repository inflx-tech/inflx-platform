# Workflow — Admin stock-image upload

1. Admin opens master-dishes → edit a dish → "Stock image" field.
2. Click "⬆ Upload stock image" → pick a file.
3. `uploadAdminStockImage(file)`: `POST /admin/master-dishes/stock-upload-url` → presigned
   PUT URL (key `stock/dishes/<uid>_<name>`) + permanent `public_url`
   (`<base>/v1/media/stock/dishes/<uid>_<name>`). Client PUTs the file to R2 (or mock POST).
4. Form `default_image_url` is set to `public_url`; thumbnail preview shows it. Save → PATCH
   `/admin/master-dishes/:id`.
5. Sellers browsing the catalogue (RestaurantDishPicker) now see the new stock image; it
   renders via the public re-sign route, so it never expires.

## Verification
- `pnpm qa` GREEN. Founder manual: edit a dish → upload an image → save → it shows in the
  admin table + the seller dish picker, and still renders after >1 hour.
