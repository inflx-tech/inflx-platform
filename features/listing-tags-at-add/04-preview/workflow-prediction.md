# Workflow prediction — listing-tags-at-add

- Details step (name/price/brand) gains a "Tags" chip row under Brand — only
  when the store's world has vocabulary tags; otherwise the row is absent.
- Chips toggle amber when selected; selections ride the staged item and land
  in brand_products.tags as slugs.
- Edit mode shows the same chips pre-selected from the product.
- Admin rule builder ("tags" condition) immediately matches newly tagged
  products in "Check matches" and live sections.
