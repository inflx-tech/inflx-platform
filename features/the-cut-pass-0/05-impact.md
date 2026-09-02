# Impact — pass 0, closing the front door

**One-line verdict: nothing that exists changes; only what can be created changes.**

## What changes for a real person

| Who | What they notice |
|---|---|
| **A new brand signing up** | One stated business type instead of two dropdowns of thirty. A non-fashion business is told so immediately, instead of finding out after building a catalogue nobody can see. |
| **The nine brands already registered** | **Nothing.** Including the one restaurant — its category, product screens, listings and dashboard are untouched. |
| **Creators** | Nothing. |
| **Shoppers** | Nothing. |
| **Admin staff** | Nothing. The approval queue is unchanged; there is simply less variety arriving in it. |

## Deploy classification

**PRODUCTION-IMPACTING.** Three targets move on push:

- **Render** — `backend/src` changed. Two new refusals on brand write paths.
- **Vercel** — the brand website's signup form changed.
- **OTA** — the brand app's signup screen changed.

This is the first change in the programme that alters **what a new customer can sign up
as**, so it is outward-facing in a way the previous deploys were not.

## Blast radius

**Small, and bounded by design.**

- No migration. No schema change. No data touched.
- No existing row is read differently.
- The only new behaviour is two refusals that could not previously happen, on two
  endpoints, for values the product no longer supports.
- Reversal is one line: add a category back to `ACCEPTED_CATEGORIES` and the server
  accepts it again. The forms would need their picker back to *offer* it, but nothing
  would be broken in the meantime.

## What could break, honestly

1. **An existing brand blocked from editing its profile.** The realistic failure. Guarded
   by making the check conditional on the field being sent, and verified against both
   profile pages, which render category read-only and send only changed fields. **Step 4
   of the device walk exists specifically to confirm this on a real account.**

2. **The mobile screen crashing at launch** from a style token that does not exist. One
   such token was found and fixed before commit. The remaining risk is another the tests
   cannot see — the emulator harness is the mitigation, and this screen is reachable on it.

3. **An automated flow that registers a non-fashion brand.** Nothing in the repo does
   this; the test-harness seeds insert directly rather than through the endpoint.

## What is NOT affected, stated explicitly

The restaurant, car-rental and salon product builders, their screens, their server
abilities and their data are all **still present and still working**. Anyone reading this
contract expecting food to be gone should read `Docs/THE_CUT.md` — this pass deletes
nothing. Passes 1 to 4 do that, and each will have its own contract.

## Cost of not doing it

Every later cleaning pass would be cleaning something still growing. A business can sign
up today as a wedding planner or a pest-control service, be approved, and build a
catalogue into a void — which is also a reputational cost with every one of those owners.
