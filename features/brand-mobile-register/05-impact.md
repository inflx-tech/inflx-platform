# Impact — brand mobile registration

**Verdict: unblocks a dead-end onboarding path — new screen + one routing line; zero change for existing brands.**

- Mobile-only (OTA deploy; no backend change — register endpoint already
  accepts everything since brand-register-location-picker; no APK rebuild —
  pure JS).
- OTPScreen change is a single branch target (Waiting → BrandRegister) on the
  no-profile path; approved/pending/rejected paths byte-identical.
- New screen reuses existing endpoints only (places autocomplete/details +
  brands/register) — no new API surface.
- First mobile surface shipping the W1 regrouped industries; web + follower
  Find regroup follows in the batched sweep (ledger W1).
