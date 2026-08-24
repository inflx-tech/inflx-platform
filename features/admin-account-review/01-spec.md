# Reviewing an account in the admin

Founder, 2026-08-24, looking at the admin page for a real pending brand:

> we have fields but data not properly populating, next platform fee is unnecessary as it
> is for review of the account, also basic info for review like their address, other main
> details are not properly handled ... as a real admin he has to check the basic things
> that he can while reviewing any account (brand or creator)

## Item 1 — the data faults (this contract)

**The data is not missing.** Preeti Chouhan supplied a full address, a pincode and a map
pin, and all of it is stored. The pages ask for it under names the server does not use, and
a name that does not exist renders as a dash — so it reads as missing data rather than a
broken screen.

### Brand page

| Shown | Page asks for | Actually called | Effect |
|---|---|---|---|
| Header name | `brand_name` | `business_name` | Falls through to the CONTACT's name. "Fashion hub" reads "Kartikeya". |
| City | `brand.city` | `users.city`, never sent | Always a dash |
| GST Number | `gst_number` | `gstin` | Dash even when supplied |
| Status badge | `status` | `user_status` | Blank pill |
| Address, pincode, pin | — | stored, never rendered | Held, never shown |

### Creator page — worse

Almost the whole page is absent from the payload. `GET /influencers/:id` never sends
`created_at`, `scrape_last_run`, `wallet_balance`, `pending_balance`, `tds_exempt`,
`tds_override_pct`, `phone`, or a `status` under that name.

**And one fault that is not cosmetic:** wallet and pending balances are divided by 100.
Money has been held in **rupees** since migration 021. A creator owed ₹4,000 reads as ₹40.

## Privacy constraint that shapes the fix

`GET /influencers/:id` is `requireRole('brand', 'admin')` — **brands call it too.** Adding
phone, wallet and pending balance to the shared payload would hand every brand a creator's
personal number and her earnings.

So the admin-only fields are attached in a **separate, explicitly gated block**, never in
the shared select. The public shape is unchanged for brands.

`GET /brands/:id` is admin-only already, so `users.city` / `users.state` go straight in.

## Out of scope — later items, already agreed

* **Item 2** — the creator list. Admin → Influencers is a CSV upload box today, so no
  creator page can be reached at all.
* **Item 3** — the review layout: facts grouped by question, Approve/Reject on the page,
  fee and feature controls hidden until a brand is approved.
* **Item 4** — the address-versus-pin check, and saying "never scraped" out loud.

## Not proposed at all

No document uploads, no verification queue, no scoring. Six brands and one person waiting.
