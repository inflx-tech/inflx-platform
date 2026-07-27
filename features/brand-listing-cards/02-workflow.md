# Workflow — B1 step 1
## Actor
Brand viewing their products.
## Steps
1. Open Products → the grid fills the screen width with bigger tiles (no fixed 4-col, no
   empty gutters on wide monitors); images are larger; product names are bigger and wrap to
   two lines instead of truncating on the photo.
## Success
- Tiles grow to fill the width; images ~190px; names 2-line + readable. No layout break;
  card actions unchanged.
## Failure/edge
- Narrow screens → 2 columns; long names clamp at 2 lines.
