# Impact — Phase 1 rule-control knobs

**Verdict: deploy-inert until an admin sets a knob.** No migration, no OTA,
no mobile change. All new WHERE clauses/filters collapse to nothing when the
config keys are absent/null/0 — existing sections produce identical queries
(proven by the unchanged section-engine failure set + passing deals tests).
`config_json` unknown-key tolerance means old backend ↔ new admin (and vice
versa) cannot 422 during the deploy window. Once a knob IS set, only that
one section's content narrows — per-section blast radius, reversible by
clearing the field.
