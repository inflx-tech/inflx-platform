# Impact — follower-address-geocode

**Verdict: addresses are now enforced Google-locatable (verify + current-location +
block-on-fail), using only the Geocoding API. Backend = 1 read endpoint + a 422
guard; mobile = AddressScreen UX. No migration, no APK.**

## Mechanics
- `createAddress` rejects (422) when neither client coords nor a forward-geocode
  resolves → no null-coord saves. `GET /follower/geocode` powers the live "Verify".
  AddressScreen: Verify + Use-current-location + Save requires resolved coords.

## Risk
- **Low–moderate.** Stricter save (could block a poorly-typed address) — mitigated by
  Verify feedback + Current-location one-tap + clear message. If Google is down,
  adding an address is temporarily blocked (acceptable for "must be recognised").
  Web QA unaffected. Reversible: revert files.

## Deploy
- **production-impacting**: Render backend + follower OTA (runtime 3). No migration,
  no APK rebuild. Surfaced for go.
