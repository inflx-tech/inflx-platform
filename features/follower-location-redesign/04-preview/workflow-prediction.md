# Workflow prediction — Follower v2 location flow

What the founder should see when reviewing the mockups (`location-flow.html`):

1. **Entry** — no location yet → entry screen. Tap "Use current location" →
   system permission → GPS + reverse-geocode → home with location set. Or tap
   "Enter location manually" → Select your location.
2. **Select** — search pill + use-current/add-new pills + saved addresses +
   recently searched. Tap a saved/recent → location set, back to caller.
3. **Search** — type ≥2 chars → live results list → tap → exact coords set.
4. **Map (Wave B)** — centre pin, drag to adjust, "zoom in" warning if too far
   out, "Confirm & proceed". (APK round.)
5. **Add address** — "Located: <area>" confirmation, form, Save-as chips, Save →
   appears under saved addresses.

Predicted end state: a follower can set a delivery location three ways (current
GPS, search, saved/recent) and add a new saved address — all on the white/yellow
`toing` skin, with no backend change.
