# Impact — follower-category-subcat-circles

**Verdict: visual revision of the Category sub-cat selector (pills → round circles).
No data/logic change; filtering unchanged. Founder-approved deviation from the
locked mockup.**

## Mechanics
- `CategoryCircle` gains an additive `active` prop. `CategoryListScreen` swaps the
  pill row for a `CategoryCircle` carousel. Sub-type derivation + client-side filter
  unchanged.

## Risk
- **Very low.** Additive component prop; one screen's bar markup. Web QA unaffected.
  Mitigation: babel transform + founder Maestro/APK smoke.
- Reversible: revert the two files + re-publish OTA.

## Deploy
- **production-impacting** (follower OTA). Surfaced for go; never silent.
