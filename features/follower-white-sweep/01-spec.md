# follower-white-sweep — Discover becomes Home · Profile · Addresses

Founder locked the board (04-preview/mockups/white-sweep.html) in the
browser pane, 2026-07-27: "pls lock it and build it" — including the
structural nav decision on frame 1.

## Scope

1. **The flip (structural)**: the app OPENS on Discover. HomeTab now
   renders the Discover|Posts|Videos surface (PostsFeedScreen, default
   top-tab = Discover). The old Creator-Vibe sections home and the center
   Posts FAB retire from navigation ("zero baggage" — files stay on disk
   for a later cleanup contract). Bottom nav: Home · Orders · Profile,
   white-law styling (white bar, black active, grey inactive). The admin
   "App Builder (legacy)" is now driverless for the global home.
2. **Profile (MeScreen rewrite)**: white law — identity card (initial
   avatar, name, masked phone, Edit placeholder) → Shopping group
   (Orders / Wishlist / Addresses / Returns / data-gated Wallet) →
   Following group (creators, saved posts) → red Log out (clears session
   in place; no forced login screen). GUEST state per the guest-first
   law: honest card + black sign-in CTA + only the rows that work
   logged-out (Wishlist, Addresses).
3. **Addresses reskin**: toing tokens swapped for white-law constants +
   system font; save button black (not a buy action). Verify/GPS/guest
   logic byte-identical.
4. **Light passes**: FollowedInfluencers + SavedScreen palette shims
   remapped to the white law (logic untouched).
5. **Navigator safety**: ProfileStack gains explicit Wishlist /
   PostProduct / Cart / ReviewOrder / OrderConfirmation registrations
   (it doesn't spread SHARED_SCREENS; each name once per stack — the
   duplicate-route crash class rule).

## Out of scope

Deleting retired screens from disk (cleanup contract) · Edit-profile
form · notifications surface · Videos content (parked) · admin App
Builder page removal.
