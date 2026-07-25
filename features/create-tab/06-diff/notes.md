# Before / After — Create tab

**Before:** Posts had no tab. Entry was two **off-system** tiles buried in Home
(hardcoded `#1A1A1A`/`#F6B11E`, emoji 📸/🖼️) → `PostComposer` / `MyPosts` (registered
in the Home stack). `MyPostsScreen` ledger used ad-hoc hex status pills.

**After:** a first-class **Create** tab (3rd position: Home · Collabs · Create ·
Earnings · Profile). `CreateScreen` = IG-clean header + an ink "New Post" CTA + the My
Posts ledger restyled to the IG kit (status dot+label, cover thumb, slides/products
meta, rejected reason + "Try again"). All Posts entries route through the Create tab.

## Mockup → build fidelity
Mockup: `04-preview/mockups/create-tab-ia.html` (Create column).
- 5-tab bar with Create (plus icon) — **matches**.
- Ink New Post CTA + hairline post rows + status dot+label — **matches**.
- Rejected post shows reason + retry — **matches** (as "Try again").

## Wiring
- `InfluencerNavigator`: added Create tab + Create stack (CreateMain + PostComposer +
  MyPosts); removed PostComposer/MyPosts from HomeStack.
- `HomeScreen`: removed the two Post bolt-on tiles.
- `CampaignProductsScreen`: "Create Post" CTA → `navigate('Create', {screen:'PostComposer'})`.
- `PostComposerScreen`: post-submit `replace('MyPosts')` → `replace('CreateMain')`.

## Known mockup-vs-build deltas (expected, not defects)
1. The **PostComposer wizard** is still the current (pre-restyle) screen — its IG-clean
   restyle is a later contract.
2. "Try again" opens a **fresh** composer (true prefill edit-and-resubmit needs composer
   edit support — later).
3. Post rows show slides + products (the `getMyPosts` payload) rather than the mockup's
   views/saves.
4. `MyPostsScreen.js` is now unused (kept registered as a safety net; file deleted in a
   later cleanup).

## Verification status
- Pure `postStatusMeta` + module-load smoke: `__tests__/createTab.test.js` — green.
- Full mobile jest: **69/69 green.**
- Navigation swept: no dangling `PostComposer`/`MyPosts` target; all resolve in the
  Create stack.
- **Pending (device gate):** Maestro flow (Create tab → ledger → New Post → composer →
  submit → back to Create ledger).
