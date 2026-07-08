# Impact — listing-home-consolidation

**Verdict: zero functional loss — landing + naming consolidation; every
capability keeps exactly one home.**

- Frontend-only, two files. The old store page remains fully functional as the
  setup surface (?setup=1); it just stops intercepting the Listings nav for
  drill-down brands.
- Redirect no longer waits for setupDone — first-visit brands land on the new
  page with a setup banner instead of the setup interstitial. Setup remains
  one click away.
- Rollback: revert one commit.
