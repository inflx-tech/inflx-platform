# item19-home — impact

**Verdict: safe to build. No database change, no money moves, no existing screen or answer changes.
Home is added beside what exists; the only behaviour that changes for an existing user is which tab
the app opens on and that the Home tab now has content.** Deploy = push + phone updates
(creator, brand). Website untouched.

## What is added
- **Server:** `services/home.service.js`, `services/homeCopy.js`, `routes/item19.routes.js` — six reads:
  `GET /brands/me/home`, `/home/needs`, `/home/waiting`, and the same three under `/influencers/me`.
  Read-only. Each runs a fixed number of queries whatever the number of collaborations.
- **Phone:** `screens/home/` — BrandHomeScreen, CreatorHomeScreen, HomeListScreen (Needs you, all /
  Waiting on others, all — one screen, `side` + `list` params), BrandNotificationsScreen;
  `components/home/` (rows, sections, copy); a small count store for the tab icon.

## What is touched, and how it stays the same
| File | Change | Why existing behaviour holds |
|---|---|---|
| `services/invitationRows.service.js` | the two row queries become functions that take extra columns; `brandRow`, `creatorCard`, the helpers and both queries are exported | called with no extras they produce the same SQL text as today; `creatorsForSet`, `invitationsForCreator` and both single reads are not edited |
| `controllers/campaignSets.controller.js` | the campaign-summary building is lifted into one exported function the handler calls | same code, same output; covered by the existing item 4 tests |
| `routes/index.js` | mounts `item19.routes` | additive |
| `components/shell/PendingHomeScreen.js` | approved → the new Home (was "coming soon") | the pending branch, the /me read, the status store and the Finish-profile sheet are not edited |
| `navigation/BrandNavigator.js`, `InfluencerNavigator.js` | Home becomes a small stack (Home, its two lists, brand Notifications); approved opening tab → Home; the count on the Home icon | the tab lock, `initialTabFor` for pending accounts and every other stack are untouched |
| `screens/influencer/CreatorNotificationsScreen.js` | the tap map gains the eight screen codes that did nothing | the five that work keep their routes |
| `screens/influencer/CollabsScreen.js` | re-reads `route.params.segment` when it changes | first-mount behaviour identical; needed so "Running now → See all" lands on Active |
| `services/api.js` | six read functions | additive |

## The rule, and how it is kept honest
The set screen and the Collabs card decide a row's one button on the phone (`setRowStep`, `cardStep`),
from fields the server sends. Home has to order and count on the server, so the same decision is made
there from the same fields (`home.service.js` `brandStep` / `creatorStep`). Two copies of one rule can
drift, so a test locks them together: the backend test writes the real rows it seeded, with the
server's verdict, to a fixture file; a phone test feeds each of those rows to `setRowStep` / `cardStep`
and requires the same verdict and the same button word. Home's button words are the same constants
the set screen uses (`C5`, `C6`), not copies.

Home adds what that rule cannot see, each from stored state: brand — book again, a parcel difference,
confirm the return; creator — mark the visit done, correct the address, send the products back; both —
Delayed, and the cutoff test on Sign / Send agreement. These do not change the set screen or Collabs.

## Decisions taken while planning (inside the locked board)
- **"Send a new time"** uses the set screen's own button word for it, **Plan the visit**.
- **Mark the visit done** shows from the day of the agreed visit until she marks it or a new time is set
  (the rule lets her mark from the moment the time is agreed; listing it days early would be noise).
- A collaboration can give **two rows** when two different things are owed (review the content *and*
  confirm the return). Each row is one thing; no single row is ever in both lists.
- An agreed visit that has not happened yet is in **neither** list: nobody owes anything. It is in
  Campaigns / Running now.
- Before-signing rows disappear from both lists once the cutoff passes (they are expired in all but name
  until the hourly job stamps them).
- Completed collaborations are not read at all, except an open Remote return.
- **Opening a screen from a tapped push notification is not in this item:** it needs the app's start-up
  code to route for all three apps and a device to prove it. The in-app lists route correctly.

## Risks
- **Load:** the brand read runs the set screen's row query once over all live rows. It is one query, but a
  brand with several hundred live collaborations pays for it on every Home open. Bounded by reading only
  live statuses; measured in the test (query count), not yet under real volume.
- **Opening tab:** every approved launch now lands on Home. If the read fails, Home shows the usual
  retry state and the other tabs work.
- **The count on the tab** is as fresh as the last Home read: refreshed on Home focus, on app
  foreground and when any tab is pressed (throttled).
- **Orders row** opens the website in the browser; the brand must be signed in there.

## Not changed
Any money path; agreements; the shoot, content and going-live steps; the wallet; the website; the
shopper app; the two old "needs you" counts (left as they are, still unused by the phone).
