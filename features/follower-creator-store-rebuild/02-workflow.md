# Workflow — Follower Creator Store rebuild

## Flow
1. Follower taps a creator (story / search / link) → CreatorStore with `{ handle }`.
2. Screen fetches `getStore(handle)` → `{ influencer, offers }`.
3. Derives client-side: collabs = distinct brands across offers; category tabs =
   distinct brand categories; picks = offers (filtered by the active tab); top picks =
   picks sorted by discount.
4. Renders the mockup: top bar → hero (avatar/handle/counters/Follow+Share/bio) →
   My Store Collabs → category tabs → What {creator} Promotes → Top Picks 🔥 → Reels note.
5. Tap a collab → BrandStore. Tap a category tab → filter picks in place. Tap a pick →
   route by availing mode (PayAtStore/PreBook/Enquiry) else BrandStore, carrying 4-ID
   tracking. Follow/unfollow toggles via followerApi.

## Expected end state
Matches `creator-store-comprehensive.html`; every creator's store auto-fills from their
own collabs + picks; attribution preserved on every tap.

## Verification
- JSX/syntax validated via project Babel (clean); tokens/fonts confirmed present.
- Data: getStore(handle) already powers the previous screen (proven endpoint).
- Visual + interaction: founder on device after OTA (no emulator in build env).
