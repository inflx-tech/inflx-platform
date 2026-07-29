# 04 — Workflow prediction

Stated before the diff is captured.

## Admin side

Paste a list into `/admin/marketing/add` → Bulk, using
`type,handle,name,city,state,category,subcategory,phone,email`.

- Handles the system has never seen → **Created**, deep scrape fires.
- Handles it already knows, **with** a city/state in the row →
  **Re-tagged**, and the per-row detail names the fields written
  (`["city","state"]`).
- Handles it already knows with no city/state → **Duplicates**, as
  before.

The predicted headline number for the founder's first real upload is a
large **Re-tagged** count, not a large Duplicates count — most of the
IDs they tag will already be in the table from earlier scraping. If
Re-tagged reads 0 and Duplicates is high, the state column did not
reach the server and something is wrong.

Old 8-column rows without a state still parse; the field just goes up
empty.

## Brand side

- **State** dropdown lists only states with tagged creators, each with
  a count, most-populated first.
- **City** is disabled until a state is chosen, then lists only that
  state's cities. Changing state clears the city.
- Results narrow immediately, and the tier chips re-count within the
  selection.

## Verified in advance against production

Run inside `BEGIN … ROLLBACK` on the live database, with AP/TS tags
simulated:

| | |
|---|---|
| Andhra Pradesh | Nellore 16, Vijayawada 10, Guntur 1, Visakhapatnam 1 |
| Telangana | Hyderabad 6, Godavarikhani 1 |
| `state=Telangana` | 7 creators |
| onboarded rows with a city | 8 → 28 |

Confirmed afterwards that `creator_profiles.state` does not exist in
production — nothing persisted.

## Explicitly NOT predicted

- **The current numbers meaning anything.** The founder has said the
  existing rows are dummy data. The point is that the workflow holds,
  not that Nellore has 16 creators.
- **Creators with no location appearing anywhere.** They are excluded
  from the lists and from area searches by design.
- **A Telugu-states-only dropdown.** Ordering by count puts them on
  top; other states remain reachable rather than stranded.
- **Existing rows gaining a state.** Nothing is backfilled — states
  appear only as the founder tags them.
