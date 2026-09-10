# profile-only-apps — before / after

No mockup: this contract draws nothing. It removes screens the founder named. The design of
record is the founder's instruction of 2026-09-10 and the four clarifying answers in 01-spec.md.

## Before → after, per app

**Brand.** Five tabs (Home · Creators · Campaigns · Wallet · Profile), 37 screens. After: no tab
bar; Brand Profile is the app. The Other card keeps Open Web Dashboard and Legal & Policies.
Notifications and Media Gallery are gone.

**Creator.** Five tabs (Home · Collabs · Create · Earnings · Profile), 26 screens. After: no tab
bar; Profile is the app. The Brand Outreach card is gone. Account details, photo, stats, Legal
and Log out remain.

**Shopper.** Three tabs (Home · Orders · Profile), 31 screens. After: no tab bar; Profile is the
app.
- Guest: "Browsing as guest" · "Sign in to see your profile" · the Sign in button · Legal.
- Signed in: name card with Edit · Legal · Log out.

## Numbers

- Files: 118 deleted (89 screens, 28 test files, 1 fixture), 3 profile screens edited, 3
  navigators rewritten, 2 shared test files trimmed.
- Tests: 729 → 355 across 54 → 26 suites, all green. Every drop is a test of a deleted screen,
  plus two blocks that read deleted screen source; each is noted where it lived.
- Production JS bundle: ~3.2 MB → 1.66 MB.

## Device walk (for the founder)

Open each app twice (OTA loads on the second launch). Each should open on its profile with no
tab bar at the bottom. Tap Legal & Policies, then a document, then back. Shopper: as a guest,
tap Sign in and back; signed in, tap Edit and back.
