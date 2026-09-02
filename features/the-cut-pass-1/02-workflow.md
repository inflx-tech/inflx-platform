# Workflow — pass 1, hiding the removed surfaces

## The workflows this protects

Everything that **survives** the cut. The point of a hiding pass is that the workflows
still in scope are untouched:

- A brand signs in, builds a campaign, invites a creator, signs a contract, arranges a
  shoot, reviews content.
- A creator signs in, receives an invitation, negotiates, signs, posts, gets paid.
- A shopper browses, buys for delivery, returns something, saves things, leaves a review.

**If any of those changes behaviour in this pass, the pass is wrong.**

## The workflows being taken away

### Cut 1 — the agency app

**Before:** a fourth mobile app. A partner agency signs up, is approved by staff, sees a
home screen, a profile and a wallet, and can withdraw money — with no approval step, unlike
brands.

**After:** the app does not exist. Its screens, its navigator, its registration form, its
API bindings and its Android build flavor are gone. Someone signing in with an `agency`
role now gets the plain "this app is for brands, influencers and followers" message
instead of being routed into a dead app.

**Who is affected:** nobody. Production holds **zero agency accounts** — checked directly
against the live database, along with zero agency payouts and zero agency withdrawals.

## The end state each cut must reach

| Must be true | How it is checked |
|---|---|
| Nothing imports a deleted file | Repo-wide search for every deleted name |
| Every edited file still parses | Parser run over each, plus the full test suite |
| The surviving apps still build a bundle | The OTA publish itself is the proof |
| No workflow in scope changed | Test suite green at the same count or higher |

## Where it can go wrong

| Risk | What would happen | How it is handled |
|---|---|---|
| A dangling import of a deleted screen | App crashes at launch — builds clean, dies on the handset | Searched for every deleted name before commit |
| A navigator still routing to a removed screen | A tap goes nowhere, silently | Route registrations removed in the same commit as the screen |
| Publishing a bundle for a removed flavor | An installed app gets JS with no screens for it | `agency` removed from the OTA publisher, so `all` can no longer target it |
| Staging more than the cut | An unrelated in-flight change ships by accident | Staged by explicit path; a broad `add` picked up pre-existing APK changes and was reverted |
