# Expected outputs

- `POST /brands/register` with `latitude: 16.5062, longitude: 80.648,
  locality: 'MG Road', formatted_address: '…'` → 201; brands row has
  lat=latitude=16.5062, lng=longitude=80.648, locality + formatted_address set.
- Same request WITHOUT any location extras → 201; row identical to pre-feature
  behaviour (all four coord columns NULL).
- `latitude: 200` → 422 VALIDATION_ERROR (out of range).
- `google_maps_url` present → server resolves via resolveMapsUrl; verified
  result overrides client-sent coords (server is source of truth).
- `GET /follower/places/details` response now includes `state` and `pincode`
  keys (null when Google omits them); existing keys unchanged.
- UI: registration completes in all three modes; switching modes never loses
  typed field values; manual mode = today's form behaviour.
