# Workflow prediction — location picker

- Default mode is Search; 90% of registrations should complete location in
  2 interactions (type → pick) with zero typing in city/state/pincode.
- Maps-link mode is the fallback for businesses whose shop name isn't on
  Google yet but who have a pin; resolver verifies server-side.
- Manual mode preserved verbatim for the founder's "he can choose whatever
  he comforts" requirement.
- Coords flow: details/resolver → form state → register payload →
  brands.lat/lng (+legacy latitude/longitude) → follower distance ranking.
- Failure prediction: Places key missing/quota → autocomplete returns [] →
  user falls back to manual (UI degrades cleanly, no error wall).
