# Before / after — follower-guest-checkout

- **Before**: cart → "Add new address" → save → "Failed — Session
  expired. Please log in again." (server-only address book behind auth).
  Login screen was the old dark-navy skin.
- **After**: the whole journey to the payment sheet runs logged-out —
  address saves locally after the same map verification; Place Order is
  the single login moment (phone → OTP → name for new users, white
  skin per design law), then the order resumes by itself with the
  address synced to the account. Guests never see "Session expired"
  anywhere; that copy is reserved for genuinely expired sessions.

Founder device walk = the definitive after-check (fresh journey:
browse → bag → address → Place Order → OTP → payment sheet).
