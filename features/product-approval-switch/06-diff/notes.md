# Before / after — product approval

Mockups: `04-preview/mockups/product-approval-switch.html` (M1–M5). Built 26 Oct 2026, the same
day the founder asked; the frames were drawn and locked by Claude under the founder's "analyse
and implement", so **the founder has not walked them yet** — that walk is owed before the deploy go.

## What matches the mockup

| Mockup | Built | Note |
|---|---|---|
| M1 the switch row | Admin → Settings → Platform, second row, under Subscription plans, with the long description | the key is declared right after `subscriptions_enforced` in `DEFAULTS`, which is the order the page draws; the existing switch renderer draws it |
| M1 the confirm | shown only when turning it **off** — *every product still waiting goes live right now* | the page's confirm step generalised from one key to two; the toast after the save says how many went live |
| M2 Product Queue | `admin/products/page.js`: Waiting · Approved · Sent back tabs with counts; each card has photo, name, brand, price, category path, *sent N min ago*, SKU; Approve (teal) / Send back (red outline) | sidebar entry **Product Queue** under CONTENT with the waiting badge; Approvals page gains a Products tile and a full-width card |
| M3 Send back | a dialog with one required reason box; the button stays disabled until a reason is typed; the server refuses an empty one (422) | the reason reaches the brand word for word in a notification |
| M4 the brand's products list | `DefaultFleetRow` (wizard-based businesses, flat and drill-down views): blue **Waiting for INFLX approval** pill with *it goes live once INFLX approves it*; red **Sent back** pill with *INFLX: <reason> — fix it, then switch In store on to send it again*; the In-store toggle stays, its tooltip says withdraw / send again | `ProductRow` (the standard products page) gets the same two pills in place of Live / Hidden |
| M5 wizard finish | **Sent to INFLX for approval** with the ⏳ mark when every product saved is waiting; the mono line reads *Sent for approval · +N*; a mixed result says *Published · +N · K waiting for INFLX* | `publishDriver` counts `approval.waiting` on each create response |

## Where it departs from the mockup, and why

- **The Approved tab lists products approved *from the queue*, not every approved product on
  the platform.** Every pre-existing product is `approved` by default; listing thousands of them
  under "Approved" would bury the decisions. The tab reads `approval_decided_at IS NOT NULL`.
- **The sidebar entry sits under CONTENT, next to Post Queue**, not under the people pipelines —
  the two queues are the same kind of work for the same reviewers (capability `approvals`).

## What has no mockup at all

The backend half, which is most of the work and is proved by
`backend/tests/product-approval-switch.test.js` (22 tests, E1–E24):

- `productApproval.service` — `required()` (a failed settings read answers **off**, so an outage
  never blocks a publish), `onCreate()` for the three insert paths, `onShowHide()` for the brand's
  toggle, `listQueue()`, `decide()`, `releaseAll()`;
- every `INSERT INTO brand_products` in `backend/src` (generic create, listing batch add + Excel
  import via `insertProducts`, the master-catalogue Excel upload) writes the gate's three columns;
- `PATCH /brands/me/products/:id { pushed_to_store }` goes through the gate; the response carries
  `approval`;
- `GET /admin/products`, `POST /admin/products/:id/approve|reject`; `pending_products` on
  `/admin/stats`; the settings save releases waiting products when the switch goes 1 → 0.

**Not one reader of "is this product live" was edited.** `pushed_to_store` stays the single flag.

## What was looked at

Render-free: the backend suite, a `next build` of brand-web, and the mockup in the browser pane.
No admin or brand session was opened against the live site (prod is the only environment and
the code is not there until the deploy). The founder's walk of M1–M5 is pending.
