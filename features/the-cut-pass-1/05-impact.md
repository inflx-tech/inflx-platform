# Impact — pass 1, hiding the removed surfaces

**One-line verdict: things disappear from view; nothing that survives changes, and nothing
is irreversible.**

## Cut 1 — the agency app

| Who | What they notice |
|---|---|
| **Agencies** | **Nobody.** Production holds zero agency accounts, zero agency payouts, zero agency withdrawals — checked against the live database. |
| Brands | Nothing. |
| Creators | Nothing. |
| Shoppers | Nothing. |
| Admin staff | The agency approval queue will never receive anything again. The page itself is untouched in this pass. |

### Deploy classification

**PRODUCTION-IMPACTING**, but only for an app nobody has.

- **OTA** — brand, influencer and follower bundles are rebuilt from source that no longer
  contains the agency screens. Those three apps do not reference them, so their behaviour
  is unchanged.
- **No agency bundle will be published.** Any installed agency APK keeps the last bundle
  it already downloaded and is not broken by this — it simply stops receiving updates.
- **Render / Vercel** — not touched by this cut. The server's `/agencies/*` endpoints
  still exist and still answer.

### Blast radius

**Effectively zero, and bounded by design.**

- No migration, no schema change, no data touched.
- No server ability removed — if a screen was missed somewhere, it fails quietly rather
  than crashing.
- Everything is recoverable from git history.

### What could break, honestly

1. **A dangling import of a deleted screen.** The realistic failure, and the one that
   builds cleanly and then kills the app at launch. Searched for every deleted name
   across the whole mobile package before commit; nothing references them.
2. **The Android build.** The `agency` product flavor was removed from the build file. A
   build targeting `agencyDebug` or `agencyRelease` will now fail — correctly, since its
   JS no longer exists. `debuggableVariants` was updated in the same commit so the
   remaining three flavors still build.
3. **A stale APK on someone's phone.** There is one, in this repo's `APKs/` folder, now
   deleted. Nobody outside has one, because nobody was ever onboarded as an agency.

## What is NOT affected, stated explicitly

The server's agency endpoints, the agency database tables, the admin agency approval
queue and the referral machinery the agency app used are **all still present and still
working**. This pass only removes what a person can see. Passes 3 and 4 remove the rest,
each with its own contract.

## Cost of not doing it

A fourth app in the build, the OTA publisher and the repo for a role with no users —
carried through every future change, and offering a withdrawal path with no approval step
if anyone were ever onboarded onto it.
