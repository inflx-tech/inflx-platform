# Pass 0 — close the front door

**Contract for the first pass of the cleaning plan in `Docs/THE_CUT.md`.**

## What this is

The founder decided on 2026-09-02: **"INFLX is a fashion platform."** 34 of the 35
business types the platform accepted are removed, along with three whole business lines
(food, rentals, salons) and everything built for them.

That removal is large and will take several passes. **This contract is only the first
one, and it deletes nothing.** It stops new wrong data entering while the rest is taken
out.

## Why it comes first

A business can sign up today as a restaurant, a car-rental firm, a pest-control service
or a wedding planner, build a catalogue, and have nowhere for a shopper to see any of it.
Until that stops, every later pass is cleaning a thing that is still growing.

It is also the highest effect for the least risk in the whole plan: nothing is deleted,
nothing existing changes, and it can be undone by editing one array.

## What it does

1. **One list, on the server.** `backend/src/services/businessCategory.model.js` holds
   the accepted categories — currently `['fashion']`.
2. **Both server paths that write the field are gated.** Registration, and the profile
   edit.
3. **Both signup forms offer only fashion**, stated rather than chosen.

## The fault this fixes, beyond the founder's decision

The business-type list was written out **three times** — the brand website's signup form,
the brand app's signup screen, and nowhere on the server, which accepted **any non-empty
string**. Both forms were therefore a suggestion, not a gate:

- A direct request could register any business type.
- A brand could register as fashion and then **change its own category** to anything
  afterwards through the profile edit, where `category` sits in the allowed-fields list.

Closing only the forms would have looked like a fix and held nothing.

## What it does NOT do

- **It deletes nothing.** No screens, no server abilities, no data.
- **It does not touch the nine existing brands**, one of which is a restaurant. They keep
  their category, keep resolving their own product schema, and can still edit their
  profile — the gate is only crossed when the category field is actually written, and
  the profile page sends only changed fields with category read-only.
- It does not remove the restaurant, rental or salon product builders, screens or data.
  Those are passes 1–4.

## Expected end state

A person opening either signup form sees one business type, stated plainly, with a line
explaining that INFLX is a fashion platform. A request that tries to bypass the form is
refused by the server with the same explanation.
