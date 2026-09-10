# profile-only-apps — workflow

1. **Survey.** List every screen in the three app folders. Find every importer; only the three
   navigators import screens, plus two screens importing each other, both deleted. Find every
   route each kept screen navigates to.
2. **Baseline.** `npx jest --runInBand` in `Packages/Mobile`: 54 suites, 729 tests, all green.
3. **Navigators.** Replace each tab navigator with one native stack: profile + legal (and, for
   the shopper, Edit Profile + Sign-in). No route name appears twice in one stack, which is the
   known native-crash class.
4. **Profile screens.** Remove every row whose destination is gone.
   - Brand: Notifications, Media Gallery.
   - Creator: the Brand Outreach card (Find brands to pitch, My Contracts).
   - Shopper: Shopping (Orders, Wishlist, Addresses, Returns) and Following (Creators I
     follow, Saved posts). The guest view loses its Wishlist/Addresses rows and the copy
     promising a bag and wishlist. Legal is now shown to guests too.
5. **Delete** 118 tracked files with `git rm`: 89 screens, 28 test files, 1 test fixture.
6. **Tests that read deleted screens from outside those folders:** campaignPrime R-1 and the
   collabDetailModel "every hero action is wired" block. Both assert things about a screen that
   no longer exists, so they are retired with a note. The model tests beside them stay.
7. **Verify.**
   - jest, serially.
   - A production Metro bundle (`react-native bundle --dev false`). This catches any import of
     a deleted file.
   - eslint `no-undef` / `jsx-no-undef` on every edited file.
8. **Ship.** Commit by path, run the OTA for all three flavours, record the versions, push.
