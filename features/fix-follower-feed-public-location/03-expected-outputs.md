# Expected Outputs — follower feed public + location-based

| Step | Observable | Verified by |
|---|---|---|
| Fix | `follower.controller.js getFeed` anon-safe; city = follower?.user_city \|\| req.query.city | `git diff` |
| Test | realigned: anon `?city=Vijayawada` → 200 + feed.length>0; renamed | `git diff` |
| qa:db | realigned follower-feed test GREEN; 3 sibling follower-feed tests GREEN | fresh `pnpm qa:db` |
| Regression | main `pnpm qa` 66 GREEN / C1 / gate 0 | `pnpm qa` |
| Carve | `backend-defect-follower-feed-noauth-500` closed (public+location) | carve lock updated |

## Hard expectations
- Anonymous /feed → 200 location-based (NEVER 401/500);
  signed-in → personalised. Mirrors the deployed getHomeFeed
  anon pattern (consistency, low risk).
- The realigned test passes via the BACKEND fix; it encodes the
  founder's product-confirmed contract (not a fake-green
  weakening — the prior carve was a real defect (500) + an
  asserted-wrong rule (401); both corrected).
- `followerService.getFeed(null, city)` null-safe (verified P12)
  — no service change.
- Deterministic instrument → exact; no new 500s.
- PRODUCTION-IMPACTING: classified, surfaced, founder-authorized.
