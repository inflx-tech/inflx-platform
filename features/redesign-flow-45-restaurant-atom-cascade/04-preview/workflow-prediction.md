# Flow 45 — Workflow prediction (pre-implementation)

This flow restyles shared components, not a navigable screen — so the "workflow"
is what users see wherever these atoms appear once the converged bundle is live.

## What changes for the user
- Any restaurant **card** (browse/feed/store) shows the unified `#FFC107` yellow,
  white surfaces, and ink/yellow accents instead of the Wave-4 `#EAB308`.
- **Creator chips** everywhere (incl. the already-shipped Wallet + BookingConfirmed
  screens) snap to the exact brand yellow.
- **Status pills** (Open till …/Closed/Pending/Confirmed/Cancelled/Live) use the
  brandPalette pales; the green open-dot + mono uppercase label stay.
- **Offer pills**, **filter chips**, **time slots**, **veg dots**, **Sagar's-picks
  strips**, and the **filter sheet** all align to brandPalette.

## What does NOT change
- No new screens, no navigation, no data, no behaviour. Every tap target, toggle,
  and composition is identical. The dining/detail/cart SCREENS that arrange these
  atoms are restyled in the following F4 flows.

## Why atoms-first
Converging the shared atoms now means each subsequent F4 screen flow is a thin
screen-chrome restyle on top of already-correct cards/chips — fewer surprises, no
half-migrated component library, mirrors the proven F0 cascade.
