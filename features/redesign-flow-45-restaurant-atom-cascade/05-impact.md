# Flow 45 — Impact analysis

## Verdict (chat one-liner)
**Zero functional disturbance — visual + UX only.** The 9 restaurant shared atoms
move to brandPalette; every prop API, render branch, and composition preserved
verbatim, so all consumers render unchanged.

## Classification
- **production-impacting** — follower OTA bundle serves the converged atoms.
- Mobile JS-only; no backend, no migration, no native rebuild (NATIVE_RUNTIME=2).
- Brand/influencer carry the shared bundle. The only restaurant atom reachable from
  brand/influencer code paths is **CreatorChip** (used by follower screens only in
  practice); no brand/influencer SCREEN changes. Shared bundle hash is identical
  across the 3 flavors.

## Cascade surface (consumers — render unchanged)
- **This flow's visible beneficiaries (next F4 flows):** DiningHome, DiningBrowse,
  DiningSearch, RestaurantDetail, RestaurantCart, RestaurantBooking, RestaurantBill,
  MealsChat.
- **Already-shipped screens that re-render via these atoms:** FollowerWallet (Flow 41)
  + BookingConfirmed (Flow 43) via CreatorChip; RestaurantBill/Cart via CreatorChip/
  OfferPill; RestaurantBooking via TimeSlot/FilterChip/OfferPill. They gain the exact
  `#FFC107` yellow — an improvement, no API change.

## Preserved verbatim (NON-NEGOTIABLE)
| Atom | Preserved |
|---|---|
| RestaurantCard | `variant`/`liked`/`onPress`/`onLike` props; feed+list branches; rating "New" fallback; composition |
| CreatorChip | `handle`/`name`/`verified`/`avatar`/`size` props; "via @h" vs "via name" branch |
| StatusPill (rest.) | `variant`/`label`/`size` props; dot+border; uppercasing; 6 variants (re-coloured only) |
| OfferPill | `label`/`icon`/`variant`/`size`; solid/soft branches |
| FilterChip | `label`/`selected`/`onPress`/`icon`/`count`; ink-on-selected |
| TimeSlot | `time`/`selected`/`full`/`disabled`/`subtitle`/`onPress`; 4 state branches; inactive guard |
| VegDot | `veg` bool/string coercion; `size` math |
| SagarStrip | `creator`/`items`/`onItemPress`/`onSeeAll`/`title`; null guard; composition |
| FilterSheet | `open`/`onClose`/`filters`/`onApply`/`resultCount`; VIBES/CUISINES/COST/MORE lists; toggle/clear logic |

## Risk
- **Regression risk: minimal-to-low.** Pure palette/font swaps; no control-flow or
  prop changes. The breadth (9 shared atoms, many consumers) is the only risk vector —
  mitigated by: prop APIs untouched, babel transform of all 9, existing restaurant
  jest suites re-run, `pnpm qa` GREEN.
- **Rollback:** OTA version pin to follower v57 (Flow 44).

## After-evidence
Emulator after-screenshots SKIPPED (atoms have no standalone screen; they become
visible when the dining screens ship next flow). After-evidence = the gallery mockup
+ founder physical APK smoke-test on live follower v58.

## Mockup sign-off + scoping
Founder green-signaled the gallery mockup via AskUserQuestion 2026-05-28 ("go and
implement") AND chose the decomposition (atom-cascade-first) + StatusPill resolution
(re-theme, keep both) BEFORE any component code. `mockup_locked=true`.
