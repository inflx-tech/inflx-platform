# Workflow — follower feed public + location-based

> Step 2. Verifier: `pnpm qa:db` (realigned test GREEN by the
> backend) + main `pnpm qa` regression.

## Preconditions
Carve `backend-defect-follower-feed-noauth-500` open RED.
Founder product decision 2026-05-19 (public browse; location
feed for anon; personalised for signed-in). `getHomeFeed`
anonymous pattern + `followerService.getFeed` null-safety
verified (P12).

## Steps
1. `follower.controller.js getFeed` → mirror getHomeFeed anon
   pattern (done).
2. Realign the carved test → anon `?city=Vijayawada` ⇒ 200 +
   location-based feed (offer surfaces); renamed (done).
3. `pnpm qa:db`: realigned follower-feed test GREEN; the 3
   other follower-feed tests stay GREEN; no regression vs
   post-P12 baseline; no new 500s.
4. main `pnpm qa`: 66 GREEN / C1 / gate 0.
5. Step-14 RELEASE — PRODUCTION-IMPACTING, surfaced; commit
   with this approved contract; push → Render.
6. Close the carve `backend-defect-follower-feed-noauth-500`
   (resolved: public+location per product decision).

## Success definition
Anonymous /feed → 200 location-based (never 401/500); signed-in
→ personalised; realigned test GREEN via the BACKEND; the 3
sibling follower-feed tests GREEN; zero main-lane regression;
deploy surfaced.

## Failure / edge
- If anon feed empty when ?city matches a published offer →
  investigate (verify-twice the ACTIVE_CI_QUERY/city path), do
  not force.
- followerService.getFeed null-id edge → confirmed safe (P12);
  the deterministic qa:db is the proof.
