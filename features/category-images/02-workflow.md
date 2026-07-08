# Workflow — category-images

1. Admin → Category Images → pick "fashion".
2. The category tree lists every node (indented), each with a thumbnail +
   Upload.
3. Admin clicks Upload on "Topwear" → picks a file → crop modal (1:1),
   auto-centred → Use this crop.
4. Cropped image uploads (section presign) → PATCH sets meta.image_url → the row
   thumbnail updates. Remove clears it.
5. Follower: the CategoryBrowser rail and the all-categories tiles show that
   picture for Topwear; nodes without a picture keep the coloured placeholder.
