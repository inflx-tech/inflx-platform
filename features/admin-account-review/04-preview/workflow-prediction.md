# Workflow prediction

1. **Admin → Brands → Preeti chouhan.** Header reads **Preeti chouhan**, not "Preeti
   Chouhan" the person; the pill reads **PENDING**, not blank.
2. Category **home_beauty**, City **Karnal**, GST **Not provided** — no dashes.
3. A new **Address** block: House no. 225/7 · Karnal — 132001 · Karnal, Haryana, India.
4. **Admin → Brands → Fashion hub.** Header reads **Fashion hub**, with **Kartikeya** as
   the contact. Before this it read "Kartikeya" as the business.
5. **A creator page** shows phone, joined date, and either a last-checked date or
   "Never checked".
6. Wallet and pending read as whole rupees, roughly 100x what they showed before.
7. **A brand searching creators sees no change at all** — no phone, no balances.

Most likely failure: the admin block not attaching because the role check reads the wrong
field, leaving the creator page looking exactly as it does now.
