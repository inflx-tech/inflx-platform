# Workflow prediction — follower-page-builder

What the mockups demonstrate and what the built screens must match.

## Mockup 1 — `destination-chooser.html`
Predicts the section config editor (in `/admin/sections`) after adding the
**"On tap, go to…"** control. Demonstrates:
- The control sits below the rule/config block, above the enable toggle.
- Four choices: Default · Product grid · Category browser · A page.
- Choosing **Category browser** reveals a category-node/vertical picker.
- Choosing **A page** reveals a dropdown of enabled custom pages.
- Default selected → no sub-picker, behaves as today.

Prediction: when the admin picks "A page → Summer Sale" and publishes, that shelf's
`config_json.tap_destination = {type:'page', page_key:'summer_sale'}`.

## Mockup 2 — `custom-pages.html`
Predicts (a) the new `/admin/custom-pages` manager and (b) the new **Custom page**
scope tab in the App Builder. Demonstrates:
- Pages list: each row = label · key · enabled toggle · Compose / Rename / Delete.
- "＋ New page" modal: label (required), auto-derived key (editable, unique), title,
  subtitle.
- App Builder header gains a 4th scope tab "Custom page" + a page dropdown; selecting
  a page shows its (initially empty) section stack ready to compose.

Prediction: creating "Summer Sale" → `POST /admin/pages` → appears in list and in the
App Builder page dropdown; composing + publishing writes `section_config` rows under
`screen='page', scope_value='summer_sale'`.

## Follower runtime (no mockup — reuses live engine)
The follower-side `FollowerPageScreen` reuses the existing `<SectionRenderer>` and
section visuals already shipped (Home/Brand/Creator). No new follower visual design;
the page is a header + the same section stack. Verified by founder walk, not a mockup
(consistent with brandstore-admin-composed's mockup waiver for engine reuse).
