# Before / after
- Before: gallery unioned all images leading with image_url/cover (colour 1);
  colour tap reset to index 0 = colour 1's photo; stale ScrollView offset.
- After: gallery leads with the active colour's images; ScrollView keyed by
  colour remounts to its first photo. Fallback to shared gallery when a colour
  has no photos. esbuild clean; pnpm qa GREEN.
