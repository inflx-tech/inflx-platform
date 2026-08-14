# 06 — Before/after diff: follower-profile-repairs

**Before** = `04-preview/mockups/profile-repairs-comprehensive.html` (locked by
the founder, 2026-08-14). **After** = the built screens.

## Frame 1-2 — Saved posts

| Mockup | Built | Match |
|---|---|---|
| Two-up grid, newest save first | `SavedPostsScreen`, `numColumns={2}`, server orders by save time DESC | ✓ |
| Creator avatar + handle under each card | avatar with initial-letter fallback | ✓ |
| Product count on the right | `product_count` from the feed serialiser | ✓ |
| Play badge on video cards | rendered when `media_kind === 'video'` | ✓ |
| Empty state: "Nothing saved yet" | same copy, same icon treatment | ✓ |

**Deliberate difference:** the mockup shows four filled cards; the real screen
uses the **feed's own card data** (`cover`, `creator`, `product_count`) rather
than a new payload, so the endpoint reuses `listFeed` with a `savedOnly` flag.
No new serialiser, no second shape to keep in sync.

**Honest gap:** cards show the cover image and creator only. The mockup implies
nothing more, but note the screen does **not** show *when* it was saved — the
data is there (`post_saves.created_at` drives the ordering) and can be surfaced
later if you want it.

## Frame 3 — Addresses with delete

| Mockup | Built | Match |
|---|---|---|
| Delete affordance per row | trash icon, top-right of each card | ✓ |
| Confirm sheet naming the address | `Alert` titled "Delete this address?" quoting the label | ✓ |
| Red destructive / plain cancel | `style: 'destructive'` + Cancel | ✓ |
| Reassurance about past orders | same sentence as the mockup | ✓ |

**Deliberate difference:** the mockup draws a **bottom sheet**; the build uses
the platform `Alert`. Reason: every other destructive confirm in this app
(logout, unfollow, cross-brand cart replace) is an `Alert`, and inventing a
one-off sheet for this single case would make the delete feel like a different
kind of action than it is. Same copy, same button order, same colour law.

**Guest addresses** were not in the mockup and had to be handled: they live on
the device and have never reached the server, so those are really deleted while
account addresses are soft-deleted.

## Frame 4 — Edit profile

| Mockup | Built | Match |
|---|---|---|
| Name + Email fields | `EditProfileScreen` | ✓ |
| Phone read-only with the reason stated | grey field + "Your phone is how you sign in…" | ✓ |
| Inline red error under the offending field | server's `error.field` targets the message | ✓ |
| Black "Save changes" + plain Cancel | ✓ | ✓ |

The mockup shows the duplicate-email error specifically; the build routes **any**
field-scoped server error to its own field, so a bad email format lands in the
same place rather than in a generic toast.

## What is proven, and how

- **409 web/API tests + 141 mobile tests green**, including 23 new contract
  tests and 10 new event-queue tests.
- Route order (`/posts/saved` before `/posts/:id`) asserted against the **real
  Express router stack**, not a source-text guess — registered the wrong way
  round, the screen would 404 with nothing obviously wrong in the code.
- All **five** address read paths verified to filter soft-deleted rows; the
  regex was checked to be matching real `SELECT`s rather than passing vacuously.
- Every touched mobile file babel-validated.

## What is NOT proven yet

**No on-device run.** Maestro was not executed — there is no connected device in
this environment, and per the standing arrangement the founder is the on-device
gate. Specifically unverified by machine:

1. The saved-posts grid at real device widths with real images.
2. The delete confirm's appearance on MIUI.
3. Keyboard behaviour on the edit form on a small screen.
4. That `SavedPosts` → `PostViewer` navigation works from inside `ProfileStack`
   (`PostViewer` is newly registered there — registering a duplicate route name
   in a native stack is the v93 uncatchable-crash class, so this was checked by
   reading: it appears exactly once in that stack and is absent from
   `SHARED_SCREENS`).

Item 4 is the one worth tapping first after the OTA.
