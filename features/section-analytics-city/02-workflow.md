# Workflow Definition — Section analytics + city scope

## Actor
Admin in App Builder; follower on the app (or simulated via API).

## Workflow steps
### City (P5a)
1. Admin types a city in the new City-override input (e.g. "vijayawada") →
   the builder loads/composes that city's stack (scope_type='city').
2. Admin adds a section there → Publish 200 → row saved with
   scope_type='city', scope_value='vijayawada'.
3. Follower endpoint WITH ?city=vijayawada (or profile city) → payload
   INCLUDES the city section; a follower in another city → EXCLUDED.
4. A city row sharing shelf_key with a global row REPLACES it for that city
   (merge identity) — verified via payload compare.

### Analytics (P5b)
5. POST /follower/section-event {section_key, screen, event:'tap',
   entity_type, entity_id} → 204; row lands in section_events.
6. Bad payload (unknown event) → 204, NO row (fail-open, no 4xx to the app).
7. GET /admin/section-analytics?days=7 → per-section taps/see_alls/uniques
   matching what was posted; sections with no events → absent (honest).
8. App Builder scope with events → 📊 panel lists them; scope without →
   "No taps recorded yet".
9. Mobile: SectionRenderer emits on tap + see-all (code-verified via unit/
   babel + payload contract; on-device confirm rides the founder's OTA
   verification pass).
10. Regression: pnpm qa 79/79; follower payloads byte-identical for
    no-city-override scopes.

## Success definition
City-scoped composition round-trips end-to-end and actually reaches the right
city's followers; every surfaced analytics number traces to a real
section_events row; zero regression.

## Failure / edge workflows
- Event endpoint down → app unaffected (fire-and-forget catch).
- City input cleared → builder returns to the world stack unchanged.
