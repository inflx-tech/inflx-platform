// Central image-frame registry (image-crop-uploader) — the SINGLE source of
// truth for every uploadable image's target shape. Each entry = the aspect the
// follower app renders that surface at (object-fit cover), plus the export
// pixel size. The crop-to-frame uploader crops to exactly this so the phone
// never crops unexpectedly. Mirrors Docs/SECTION_ENCYCLOPEDIA.md §7.
export const IMAGE_FRAMES = {
  // App Builder banners / frames (admin/sections designs)
  full_width_banner:  { aspect: 1080 / 720, w: 1080, h: 720, label: 'Full-width banner · 3:2' },
  hero_slider:        { aspect: 1080 / 560, w: 1080, h: 560, label: 'Hero slide · ~2:1' },
  announcement_strip: { aspect: 1080 / 240, w: 1080, h: 240, label: 'Announcement strip · 4.5:1' },
  split_banner:       { aspect: 1,          w: 720,  h: 720, label: 'Split tile · 1:1' },
  image_cards:        { aspect: 480 / 600,  w: 480,  h: 600, label: 'Image card · 4:5' },
  image_grid:         { aspect: 480 / 600,  w: 480,  h: 600, label: 'Grid tile · 4:5' },
  banner_with_tiles:  { aspect: 1080 / 720, w: 1080, h: 720, label: 'Banner · 3:2' },
  collage:            { aspect: 720 / 900,  w: 720,  h: 900, label: 'Collage tile · 4:5' },
  sale_zone:          { aspect: 1080 / 640, w: 1080, h: 640, label: 'Sale frame · ~1.7:1' },
  // Dashboard product photos (drill-down listing) — 3:4 portrait, the ONE
  // product-image aspect every follower card renders at (design-system-p1),
  // so a crop shows exactly as set (no re-crop by the card).
  product_photo:      { aspect: 3 / 4, w: 900, h: 1200, label: 'Product photo · 3:4' },
  // Category image (Phase 2)
  category:           { aspect: 1,          w: 600,  h: 600, label: 'Category · 1:1' },
};

export const frameFor = (key) => IMAGE_FRAMES[key] || IMAGE_FRAMES.product_photo;
