# Workflow prediction (mockup)

`photos-with-variants.html` shows the two steps side by side:
- **Step 1 (Basics):** name, brand, price, MRP, stock, SKU, description — no photo
  field at all.
- **Step 2 (Variants):** colour + size chips, then a per-colour photo uploader for
  each chosen colour (with a note that a single "Product photos" uploader appears
  instead when the item has no colour variant).

Predicted behaviour:
- Step 1 no longer blocks on a photo; it blocks only on name/price.
- Photos are uploaded once, per colour (or once for no-colour items) in Step 2.
- The main image derives from the first photo, so the Review + inventory thumbnail
  are populated without a separate cover upload.
