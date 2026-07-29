# 02 — Workflow

## W1 — The founder tags and uploads (the whole point)

1. Admin → `/admin/marketing/add` → Bulk (CSV paste).
2. Paste rows in the format
   `type,handle,name,city,state,category,subcategory,phone,email`:

   ```
   influencer,@ritu_sreeram,Rithwika,Nellore,Andhra Pradesh,lifestyle,,,
   influencer,@sunatha03,Sunu,Nellore,Andhra Pradesh,education,,,
   influencer,@somehandle,,Hyderabad,Telangana,,,,
   ```

3. Submit. Per row, one of:
   - **Created** — new handle inserted with the tag, deep scrape fired.
   - **Re-tagged** — handle already known; its city/state are updated
     and nothing else is touched. *This is the case that used to be
     silently skipped.*
   - **Duplicate** — known handle, no city/state supplied → skipped, as
     before.
   - **Invalid** — bad or missing handle.
4. The scrape fills followers, engagement, tier, bio, avatar. It never
   overwrites the tag.

## W2 — A brand searches by area

1. Discover → **State** dropdown lists only states that have tagged
   creators, each with a count, most-populated first.
2. Picking a state enables **City**, listing only that state's cities.
   Changing state clears city.
3. Results narrow immediately. Tier chips re-count within the
   selection.
4. Nobody types a place name, so `hyderabad` vs `Hyderabad` cannot
   change the outcome.

## W3 — Creator with a state but no city

Counts toward the state, and is returned by a state-only search. No
blank city option is invented for them.

## W4 — Creator with no location at all

Absent from every state and city list, and never returned by a
state/city search. Still findable by tier, niche, followers or name.
This is the founder's explicit choice.

## W5 — Onboarded creator city recovery (adjacent)

An influencer created by the admin CSV upload has
`influencers.city`/`state` but no `users.city`. After migration 146
they appear in city and state search.

Production dry-run, inside a rolled-back transaction:
onboarded rows carrying a city went **8 → 28**.

## Verification

- Migration + locations query + state filter exercised against the
  **production** database inside `BEGIN … ROLLBACK`. Confirmed
  afterwards that `creator_profiles.state` does **not** exist in prod
  — nothing persisted.
- With AP/TS tags simulated in that transaction, the dropdown resolved
  to Andhra Pradesh (Guntur 1, Nellore 16, Vijayawada 10,
  Visakhapatnam 1) and Telangana (Godavarikhani 1, Hyderabad 6), and
  `state=Telangana` returned 7 creators.
- `pnpm qa` green.
