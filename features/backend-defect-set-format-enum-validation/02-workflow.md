# Workflow — fail-fast format validation

1. Brand creates/updates a campaign set with `formats_json`.
2. `assertValidFormats` checks every entry: `type` ∈ deliverable_type enum (reel, post, story, youtube_video, youtube_short), `count` integer ≥ 1.
3. Invalid → immediate 422 VALIDATION_ERROR naming the offending value, set NOT written.
4. Valid → set written exactly as before; deliverable auto-creation at brand-sign can no longer hit the enum 500.

Expected end state: no campaign_sets row can carry a formats_json type that the deliverables table would reject.
