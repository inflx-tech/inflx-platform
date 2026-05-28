# Flow 43 — Workflow prediction (pre-implementation)

What the user will experience after the restyle (predicted from the mockup,
confirmed against the audited screen logic):

## PreBook (salon / car / generic)
1. From a store/offer → PreBook opens with an **ink hero** ("Reserve Car" /
   "Book Appointment") + yellowPale "@creator's deal" strip.
2. White offer card shows price + **yellowPale ADVANCE badge**.
3. Pick a date on the **ink-selected** date strip; enter/select time; adjust guests
   on the bg2 stepper; optional notes.
4. Tap **ink/yellow "Review & Pay ₹X"** → summary view (same palette) → mock-pay →
   inline **confirmed** view with yellow success accent + reference code.

## SlotPicker (salon)
1. From SalonDetail → SlotPicker opens, ink hero "Book appointment".
2. White service card: name + `60m · ₹1,600` (mono) + purple "@creator's deal · 25% off".
3. **Salon-pale** date strip (ink-selected), 30-min **slot grid** (booked greyed +
   struck), conditional **stylist cards** (ink-selected; off-day dimmed).
4. **yellowPale token breakdown**: Service price → Token now ₹100 → Balance at salon.
5. Tap **ink/yellow "PAY ₹100 TO CONFIRM"** → Razorpay → confirmation alert.

## BookingConfirmed (restaurant table)
1. After RestaurantBooking pay+verify → replace to BookingConfirmed.
2. **Yellow check-tile** + "Table booked" (or yellow-50 ⏳ "Reservation requested").
3. White QR card + mono ref + table#; CreatorChip; ink upsell card; requests row.
4. Bottom bar: bg2 **Directions** + yellow **Done** → popToTop.

## No behavioural change
Every tap target, navigation, payment call, and API body is identical to today —
only colors, fonts, and spacing change.
