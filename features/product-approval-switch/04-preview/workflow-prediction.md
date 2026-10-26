# product-approval-switch — workflow prediction

Mockups: `mockups/product-approval-switch.html` (M1–M5).

| Screen | Predicted | To be built as |
|---|---|---|
| M1 The switch | one more row on Settings → Platform, drawn by the existing switch renderer; a confirm when it is turned **off** because waiting products go live | `Packages/brand-web/app/admin/settings/platform/page.js` — the confirm generalised to a second key |
| M2 Product Queue · Waiting | a list card per product: photo, name, brand, price, category, sent-when; Approve (teal) / Send back (red outline); tabs Waiting · Approved · Sent back with counts | new `Packages/brand-web/app/admin/products/page.js`, modelled on `admin/posts/page.js` |
| M3 Send back | a dialog with one required reason box, sent to the brand | same page |
| M4 Brand's products list | blue pill *Waiting for INFLX approval*; red pill *Sent back* with the reason under the name; the In-store toggle still there | `DefaultFleetRow` in `ListingTemplateLayout.js`; `ProductRow` in `dashboard/products/page.js` |
| M5 Wizard finish | *Sent to INFLX for approval* instead of *You're live* when every saved product is waiting | `builtinStepComponents.js` `done`; `publishDriver` counts `approval.waiting` |

**Not drawn:** the backend half — one gate function used by four publish paths, two admin
endpoints, one stats number, the release on switch-off. See 01-spec §4–5.
