# Workflow
1. Brand fills the bulk template with Colour image URLs (comma or newline).
2. Upload → import ingests the URLs to R2 and creates the products.
3. The post-import tray shows each product with its thumbnail + "photo added" /
   "＋ More photos" — NOT "needs photos".
4. A product with no URL provided still shows "needs photos" (correct).
5. Repeating the same URLs on every size row yields one deduped set per colour.
