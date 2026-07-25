# Impact

**One-line verdict: mobile-only, zero backend change — logged-in
journeys unchanged; guests gain the address + checkout path they were
walled out of.**

- No backend/API/schema change: guest addresses use existing public
  geocode endpoints; sync uses the existing addAddress; orders unchanged.
- Food ordering flow untouched. Legacy auth gates (booking/bill)
  untouched.
- Risk: guest address rows live in AsyncStorage until first order —
  uninstalling before ordering loses them (acceptable: nothing was
  purchasable yet).
- Deploy: OTA only; `git push` is deploy-inert for Render/Vercel.
