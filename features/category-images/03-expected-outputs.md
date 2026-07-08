# Expected outputs — category-images

1. taxonomy.getTree + getNodeChildren return `image_url` per node.
2. `PATCH /admin/sections/category-node-image` sets/clears meta.image_url.
3. `/admin/category-images` lists the tree, uploads per node via the 1:1 crop
   modal, shows thumbnails, supports Replace/Remove.
4. Mobile rail + all-categories tiles render image_url with placeholder
   fallback.
5. backend boots; brand-web builds; mobile parses; `pnpm qa` GREEN.
