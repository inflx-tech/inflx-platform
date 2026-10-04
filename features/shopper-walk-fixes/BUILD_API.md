# shopper-walk-fixes — what the server now sends, and the rules for the phone build

Read with `01-spec.md` (what changes and why) and the LOCKED board
`04-preview/mockups/shopper-walk-fixes-mockups-v1.html` (frames V1–V3, S1–S7, G1–G2, B1–B2, C1–C3, table T).
The server side below is BUILT and tested (`backend/tests/shopper-walk-fixes-*.test.js`). Do not change the backend.

## 1 · The shopper app

### A post card — `followerApi.feed / post / more / saved …` (every list of posts)
```
post.deal_page            boolean   NEW. true = this post opens a deal page ("Build your deal").
                                    A discount or price post is ALWAYS false. Decide from this — never guess.
post.offer.kind           string    NEW. discount | bogo | volume | bundle | free_gift  (the type itself)
post.offer.type           string    unchanged: the DISPLAY NAME ("Discount", "BOGO"). Never compare it to a key.
post.offer.how            string    CHANGED WORDS: now said to the shopper ("Buy any product in this post and get the same one free…").
post.media[i].cover_url   string|null  NEW. A picture taken from a VIDEO slide. null for a photo, and for a video uploaded
                                    before 4 Oct 2026. It is a normal image URL (GET → 302 → the JPEG).
```
An older server answer has none of the new fields: `deal_page === undefined` must fall back to
`post.offer && post.offer.kind ? post.offer.kind !== 'discount' : false` — i.e. NOT a deal unless told so.

### The deal data — `followerApi.deal(postId)` (works for EVERY live post, deal or not)
```
data.deal_page                 boolean  (as the card's)
data.offer.how                 string   said to the shopper, with the real product and gift counts
data.returns                   { hours, words: "7 days", line: "Within 7 days of delivery" }   NEW
data.post                      { id, code, title, creator:{id,name,…}, brand:{id,name,…} }
data.products[i]:
  id, name, price, shopper_price, images[], image_url, in_deal, category{ id, name }, sold_out,
  colours: [{ colour, images[], sizes: [{ size, price, left, sold_out }] }],
  details        string|null      the description, as before
  size_chart     string|null
  set_qty        number|null
  brand_label    string|null      NEW  e.g. "Park Avenue"
  category_path  string|null      NEW  e.g. "Men › Topwear"
  specs          [{ key, label, value }]   NEW  already in display order; empty ones already removed.
                                  Never shows colour, size or brand (those have their own place).
```
Nothing else exists: no rating, no review count, no tax line, no MRP. Do not draw any of them.

### The bag's pricing — `followerApi.bagPrice(lines)` / `dealPrice` (unchanged shape)
`group.offer = { id, type, sub_type, line }` where `type` here is the RAW type. A group is a
**locked deal** when `sub_type` is one of `fixed`, `pick_any`, `mix_match`, `bogo` (spec W2).
`percentage`, `flat`, `quantity`, `value`, `spend`, `buy_x`, and no offer, are NOT locked.

## 2 · The brand and creator apps

### Going live / the brand's review — `content.path1.posts[i]`
```
cover: { url: string|null, isVideo: boolean } | null
   url is ALWAYS a picture the row can draw: the photo itself, or the picture taken from the video.
   url === null (a video uploaded before 4 Oct) → draw the dark tile with the play mark, never a blank box.
```

### A shared file — `content.rows[i].files[j]`
```
hasCover   boolean   NEW. A picture taken from this video exists.
```
`influencerApi.contentFileUrl(ciId, fileId)` / `brandApi.contentFileUrl(campaignId, setId, ciId, fileId)`
take a new last argument for the picture: the request gains `?cover=1` and answers
`{ view: { url, kind: 'photo', mime: 'image/jpeg', cover: true, expiresAt } }` (404 when there is none).
The same access rules as the file itself.

### The creator's phone makes the picture (no new app build: `react-native-compressor` 1.8.25 is in the 30 Sep builds)
`createVideoThumbnail(fileUri)` → `{ path, size, mime, width, height }`. Guard it exactly like
`utils/videoPrep.js` guards the compressor (`hasCompressor()`), wrap it in try/catch, and NEVER let a
failed picture stop the video's upload. An older build simply uploads no picture.

A file she shares with the brand (Going live path 2, Pay for Content):
```
POST /influencers/me/invitations/:ciId/content/files/:fileId/cover-url   { sizeBytes }   → { upload: { fileId, url, method:'PUT', headers, expiresAt } }
     (JPEG only, ≤ 1 MB; 422 otherwise.)  PUT the file with `uploadContentFile(upload, uri)` as the video is PUT.
POST /influencers/me/invitations/:ciId/content/files/:fileId/cover        {}              → { file }   (hasCover: true)
```
Order: upload-url → PUT video → confirm (all as today) → THEN cover-url → PUT → cover. A failure in the cover steps is swallowed.

A shoppable post's video (the post maker, `screens/create/PostMediaScreen.js`):
```
POST …/shoppable-posts/:id/upload-url { content_type: 'image/jpeg', size_bytes }  → { key, url, headers }   (the existing call)
then the slide in `media` carries it:  { r2_key, mime, width, height, duration_s, cover_r2_key: <that key> }
post.media[i].cover_url comes back.  JPEG only, ≤ 2 MB. A slide with no cover_r2_key is accepted as before.
```
IMPORTANT: every later save of `media` must send `cover_r2_key` again for that slide (the list is replaced whole).

### Already wired by the server wave (do not redo)
- Agreement screens show `money.commissionPaidWords` when present.
- Wallet: the new sale state `waiting_delivery` has its words in `components/wallet/copy17.js`.

## 3 · Rules for the phone build (all three apps are ONE codebase: `Packages/Mobile/src`)
1. The board is locked. Build what the frames show and their captions say; a caption's "Today:" line is what to remove.
   Where a frame is silent, the screen stays as it is.
2. No new native module. `Vibration` comes from `react-native` (the VIBRATE permission is in every build).
3. Colours and buttons: `theme/tokens.js` → `settingsTokens`. ONE yellow main button per screen; black fill = selected / "done";
   never a new colour. Shopper screens use the pieces in `components/shop/` (bitsShop, orderBits) — extend them, do not fork them.
4. Every sentence a screen says lives in a copy file (`copyShop.js`, `copyOrder.js`, `copy14.js`, `copy12.js`, `copyCreate.js`).
5. Navigation: a new screen needs ONE `Stack.Screen` with a name used nowhere else, and its import. A duplicate name or a
   name used without its import crashes the app natively (it has shipped three times). Check both.
6. Tests: `cd Packages/Mobile && npx jest --silent`. They must end green. A test that describes the OLD behaviour is
   changed to the new one with a one-line note saying why; never `.skip`, never delete, never weaken to pass.
   Add tests for what you build. The video player and the compressor are absent in jest — test both paths.
7. Edit files with the Edit / Write tools. Never rewrite a source file through PowerShell (`Get-Content`/`Set-Content` mangle — and ⚠).
8. Do not run git commands that change anything (no add, commit, stash, checkout, reset). Do not touch `backend/`,
   `Packages/brand-web/`, or files outside your list. Another session shares this working tree.
9. Keep what you were not asked to change. If something in the brief cannot be done as written, do the nearest correct
   thing and SAY SO in your report — do not silently drop it.
