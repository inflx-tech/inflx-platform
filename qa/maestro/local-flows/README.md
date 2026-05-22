# Local-backend Maestro flows

These flows run against the **local dev stack** (backend :3001 + dev DB
:5433), NOT production — unlike `qa/maestro/flows/*.yaml` which the
`pnpm qa:maestro` lane runs against PROD. They live here so the prod
lane does not pick them up.

## Prerequisites
1. `pnpm dev:all` running (backend + dev DB)
2. `node qa/scripts/seed-conversion-e2e.mjs` — seeds approved brand
   (+919900000001) + influencer (+919900000002, @test_creator)
3. `pnpm qa:e2e:conversion` — creates the invited conversion offer
4. `Packages/Mobile/src/config/api-overrides.js` →
   `http://10.0.2.2:3001/v1` (skip-worktree'd, local only) so the
   DEBUG app hits the local backend
5. Metro running: `cd Packages/Mobile && pnpm start`
6. App installed on emulator, e.g.:
   `cd Packages/Mobile/android && ./gradlew app:installInfluencerDebug -PreactNativeDevServerPort=8081`
   (the `pnpm android:*` scripts use the old `--variant` flag which the
   current RN 0.73 CLI rejects + can't find gradlew.bat on Windows —
   call the gradle wrapper directly as above.)

## Run
```
maestro test qa/maestro/local-flows/02-influencer-accept-conversion.yaml
```

## Flows
- **02-influencer-accept-conversion** — influencer logs in, opens the
  conversion offer, accepts it. Verified: offer flips invited→accepted
  + a draft contract auto-creates. (The follower-buy-with-coupon leg
  is the next flow to add here.)
