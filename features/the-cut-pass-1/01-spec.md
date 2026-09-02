# Pass 1 — hide everything on the REMOVE list

**Second pass of the cleaning plan in `Docs/THE_CUT.md`.**

## What this pass is

Take away the screens, pages, tabs and buttons for everything the founder removed on
2026-09-02. The server still answers for all of it, so **nothing breaks**.

After this pass the apps **look correct to a real user**, before a single risky deletion
has happened. Disconnecting the server is pass 3; erasing data is pass 4.

## Why hiding comes before deleting

Three different things get called "removing", and they carry completely different risk:

| | Risk | Reversible |
|---|---|---|
| **Hide** — stop showing it | none | instantly |
| **Disconnect** — delete the code | low | from history |
| **Erase** — delete the data | permanent | no |

Doing them in that order, with time between, is what makes a cut this large safe. Almost
every bad deletion happens because someone did all three at once.

## The order within this pass

One cut per commit, cleanest first, so any breakage is traceable to one decision:

1. **The agency app** — a whole app; the cleanest possible cut
2. Bookings · Enquiries · The shopper reward wallet · Referrals
3. Food, restaurant, car-rental and salon screens across all apps and the website
4. The pre-agreement pathway — its remaining screens and stored agreements
5. Open call, and inviting creators who are not on INFLX
6. The website's campaign builder
7. Furniture

## What this pass must NOT do

- **Delete no server abilities.** They keep answering. If a screen was missed, it fails
  quietly rather than crashing.
- **Delete no data.** Nothing in this pass is irreversible.
- **Break nothing that survives.** Fashion, campaigns, contracts, shoots, delivery
  orders, returns, wishlists and reviews all keep working exactly as they do today.

## Expected end state

A person opening any of the three apps, or the website, sees a fashion platform. The
food, rental, salon, booking, enquiry, referral and agency surfaces are gone from view.
Nothing they can still reach is broken.
