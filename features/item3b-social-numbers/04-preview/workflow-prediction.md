# item3b-social-numbers — workflow prediction

Mockups: `mockups/item3b-social-numbers-locked.html` (founder-locked 11 Sep 2026).

| Screen | Predicted | Built as |
|---|---|---|
| S1 Creator profile with platform cards | Top three numbers stay; one card per added platform (3 tiles, chevron); no card when not added | `BrandCreatorProfileScreen` + `components/social/PlatformCard` (brand mode) |
| S2 Instagram details | Account header + Open, PROFILE tiles, LAST 90 DAYS window, hero engagement + posts/week, mix bar + legend, averages, formula (+ hidden-likes line), footer | `screens/shared/SocialDetailScreen` (instagram) |
| S3 YouTube details | CHANNEL tiles, uploads line, LONG VIDEOS and SHORTS each with engagement/avg views/avg likes/avg comments, formula, footer | `SocialDetailScreen` (youtube) |
| S4 Card states | 0 posts → "—" + followers line; updating → blue box; unavailable → grey box; stale → "Updated {d}" | `PlatformCard` brand mode |
| S5 Discover card | Unchanged; numbers from the refreshed columns | item 3 `DiscoverList` (no change) |
| R1 Registration accounts step | Two steps with a 2-bar stepper; Instagram + YouTube fields; exact errors; Continue → Waiting | `InfluencerRegisterScreen` |
| R3 My Profile row | "Your numbers" between Profile info and Niche; subtitle; Fix/Waiting/Measuring chip | `ProfileScreen` + `SocialChip` |
| R4 Your numbers | Info box, two cards with dates line, hint; card → S2/S3 with the box on top | `YourNumbersScreen` + `PlatformCard` creator mode |
| R5 Problem states | waiting_check · measuring · not_found · private · rejected · failing · not added, each with one action | `PlatformCard` creator mode |
| R6 Handle change | Sheet: Change / Add / Remove copy; confirm → save | `ProfileInfoScreen` + item 2 `ConfirmSheet` |
| Admin | Handle checks tab, flags, creator panel with Measure now, cost line | `brand-web/app/admin/influencers/*`, `analytics` |
