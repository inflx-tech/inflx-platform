# Before/after — category-images

## Before
Category nodes had no picture — the follower rail and all-categories tiles showed
coloured placeholders (diamonds/triangles). No way to upload a category image.

## After
- Category node image stored in `category_nodes.meta.image_url` (no migration).
- `taxonomy.getTree` + `getNodeChildren` return `image_url` per node.
- `PATCH /admin/sections/category-node-image` (sections capability) sets/clears
  it; reuses the section image presign.
- New `/admin/category-images` page: pick vertical → flattened tree → per-node
  Upload/Replace/Remove via the 1:1 crop-to-frame modal, with thumbnails and a
  "N/total have an image" counter.
- Mobile CategoryBrowser rail + all-categories tiles render the picture where
  set; placeholder fallback where not.

## Verification
- Backend meta set/clear tested on dev DB; modules load.
- brand-web `next build` ✓ (/admin/category-images 3.9 kB); `pnpm qa` GREEN (79).
- CategoryBrowserScreen babel-parses (Image already imported).
- On-device after-capture owed on the OTA once the founder uploads a category
  picture.

## Deploy
Render (backend) + Vercel (brand-web) + follower OTA.
