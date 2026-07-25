# Workflow — expected end states

1. Profile/Orders tab → My Orders: every shop order listed newest-first
   with photo, status chip and amount; tabs filter honestly.
2. Tap an order → detail: timeline shows exactly the steps that have real
   timestamps; the current step is lit; Dispatched shows courier + AWB and
   taps through to the carrier's tracking page.
3. Order in confirmed/packed → "Cancel order" renders → confirm dialog
   states the money-truth (prepaid refund-initiated / COD nothing
   charged) → order flips to cancelled, red banner replaces the timeline,
   brand gets order.cancelled, list shows the muted red chip.
4. Brand dispatches first (race) → the cancel returns 409 and the screen
   refreshes to the dispatched truth — no late cancels, ever.
5. Delivered online order → Request Return block appears (unchanged
   Fashion-1b flow).
6. COD order shows "To pay on delivery ₹X" until delivered, then "Paid on
   delivery ₹X".
