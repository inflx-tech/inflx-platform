# backend-defect-set-format-enum-validation

> Carved from Phase A golden-journey E2E (2026-06-10, `Docs/PHASE_A_RESULTS.md`
> defect D3, run-1 evidence).

## Symptom

`POST /campaigns/:id/sets` accepts any string in `formats_json[].type`
(e.g. `instagram_reel`). The bad value travels silently through invite →
accept → negotiation → contract creation, then explodes THREE stages later at
brand countersign as `500 INTERNAL_ERROR: invalid input value for enum
deliverable_type: "instagram_reel"` — deliverable auto-creation inserts the
type into the `deliverable_type` enum column. The brand gets an opaque 500 at
the worst possible moment (money about to lock) with no hint the set was
misconfigured days earlier.

## Fix

Validate `formats_json` at the entry points (`createSet`, and `updateSet` when
formats are edited) in `campaign.controller.js`: each entry must have
`type ∈ {reel, post, story, youtube_video, youtube_short}` (the
`deliverable_type` enum) and integer `count ≥ 1` → 422 VALIDATION_ERROR with
the offending value named. No schema change; no change for valid payloads.

## Proof of fix

POST a set with `type:'instagram_reel'` → 422 naming the invalid type
(was: 201 then deferred 500). Valid sets unchanged (Phase A S3.1 stays PASS).
