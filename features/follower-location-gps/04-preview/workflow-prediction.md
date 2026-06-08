# Workflow Prediction — follower-location-gps (Contract 3)

## Design source
No new visual surface — Contract 3 changes the **source** of the coordinates that
Contract 2 already renders (distance on cards + area header per the comprehensive
mockups). So the "design" is identical to Contract 2's output; this contract just
makes the coords the device's real GPS instead of the default.

## What the reviewer should see (once the APK is installed)
- On first open, an Android location-permission prompt.
- Granted → Home/Category re-rank by real distance; header shows the real area.
- Denied / old APK / web → unchanged (default location). No crash, no blocked feed.

## Honest notes
- Native APK only — not OTA. JS is OTA-safe (guarded require → default when the
  native module is absent), so it can't break current users if it rides an OTA.
- iOS not targeted; Android manifest already declares the location permissions.

## After-capture
Founder APK smoke: confirm the permission prompt + that distances reflect actual
device location (vs the Vijayawada default). Recorded at the released flip.
