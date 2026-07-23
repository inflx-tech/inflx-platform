# Before/after — concept-p0-foundation

## Campaign wizard "Applies to → Category" (brand-web)
- **Before:** flat `<select>` of `brand_products.section` strings derived from
  the brand's own products ("Bottomwear") — cannot express "Jeans", cannot
  distinguish Men/Women, empty until products exist.
- **After:** full-path tree rows from `GET /brands/me/listing-tree`
  ("Men › Bottomwear › Jeans (12)") with live per-node counts; any level
  allocatable (subtree match server-side). Fallback to the old flat list for
  brands without a tree — visually identical for them.

## Admin nav (brand-web /admin)
- **Before:** CONTENT section listed Master Dishes, Design System, Theme
  Library, Design Library, Exp. Templates ahead of App Builder; SETTINGS
  listed Meals; Tax Summary existed but was reachable only by URL.
- **After:** CONTENT starts at App Builder (4 System-B pages deleted, food
  pages hidden); SETTINGS shows Payment Config → Tax Summary → Admin Users.

## Creator app (mobile, OTA)
- **Before:** Home showed a "Create Experience" tile → ExperienceStudio;
  MyStore/StockStore registered (unreachable).
- **After:** tile gone, three screens deleted; everything else untouched.

## Follower app (mobile, OTA)
- **Before:** Profile had a dev "Experience Preview" row (flag-gated).
- **After:** row + screen + AdaptiveRenderer components deleted. No other
  follower-visible change (experience shelves never rendered in prod — the
  rule always resolved empty).

Capture note: real-URL screenshots deferred to the release step (deploy gate);
this changeset ships behind the founder's explicit deploy go.
