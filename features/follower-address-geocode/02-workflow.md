# Workflow — follower-address-geocode

## Add-address flow
1. Open Add address. Either:
   - **📍 Use current location** → GPS → reverse-geocode → fills city + locks coords
     → "📍 Current location: {area}". OR
   - Type the address → **🔎 Verify address** → forward-geocode → "✓ Located: {area}"
     (or "Couldn't locate — add area/city/pincode").
2. **Save** → requires resolved coords: uses the verified/current coords, else
   geocodes once more; if still not locatable → **blocked** with a clear message
   (backend also rejects 422). On success → saved with lat/lng.
3. The saved address now repositions the feed when selected (location switcher).

## Build
1. Backend: `GET /follower/geocode?q=` + createAddress 422-enforce.
2. Mobile: AddressScreen verify/current-location/block + pass coords; api method.
3. babel/node-check; `pnpm qa` GREEN; OTA (no migration).

## End state
Only Google-recognised addresses save (with coords); friendly verify + current-
location; unlocatable input is blocked, not silently saved.
