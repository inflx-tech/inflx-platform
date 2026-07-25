# Workflow — expected end states

1. Bag → Proceed → Review Order shows the address (or "Add"), items with
   creator attribution, Pay with, and the bill the Bag's engine preview
   produced.
2. COD visible ONLY when the admin knob is on; selecting it adds the fee
   line (when fee > 0), relabels the total "To Pay on delivery", and the
   CTA becomes "Place Order".
3. Final tap as guest → phone → OTP → (name) → same tap resumes: guest
   address syncs, order places.
4. Online: Razorpay sheet → verify → white success screen with "Paid ₹X".
   COD: NO payment sheet; order settles immediately; success shows the
   "Cash on Delivery · ₹X due" badge. Both: brand + creator notified,
   commission credited to pending, order in My Orders as 'confirmed'.
5. Admin flips COD off → the option disappears from Review on next app
   launch AND a forced request with payment_method:'cod' is rejected 422.
6. Food ordering (OnlineOrder 3-step) and its Creator Vibe confirmation:
   unchanged.
