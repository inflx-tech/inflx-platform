# meals-admin-radius — before/after

**Mockup (before):** `04-preview/mockups/02-customer-chat-to-offer.html`
shows the customer flow with a memory-aware intent extraction → offers
→ pay. It does **not** depict an address picker (the mockup pre-dates
the founder's address-first lock).

**Implementation (after):**
- `MealsChatScreen` inserts an inline **address picker bubble** before
  any offer is computed — saved-address chips, "📍 Use my current
  location", and "+ Add new address". On selection the chat resumes
  and returns offers, exactly as the mockup downstream of the picker.
- New admin surface `/admin/meals` exists outside the customer
  mockups — it's a small settings form.

## What matches
The customer-facing sequence after picking an address is identical to
the mockup: ranked offers with the AI's starred recommendation →
Pay-before-cutoff → Order locked.

## What diverged (intentional, this phase)
- Address picker is **new**, locked by founder 2026-05-23: no offers
  are suggested until the customer confirms a delivery address.
- "Use my current location" uses a default coord for now (Vijayawada
  area, ~16.5062 / 80.6480). A real geolocation lib install
  (`@react-native-community/geolocation` or `expo-location`) is a
  later refinement; the saved-address chips already route on real
  lat/lng when the address has them.

## What to check manually
- `/admin/meals` round-trips radius / tolerance / lead minutes.
- Customer chat in any restaurant → first message → picker appears
  → choose address → offers → pay → lock.
- An in-store chat with a "far" saved address → "outside delivery
  range" message.
