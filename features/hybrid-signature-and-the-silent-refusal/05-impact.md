# Impact

## Verdict

**One list was wrong, and one message was in the wrong place.** Between them they made a signature
impossible and its refusal invisible.

## What changes

| Layer | Change |
|---|---|
| Backend | `deliverables.model.js` — `CONTENT_REQUIRED_GOALS` separated from `CONTENT_BUYING_GOALS`; Hybrid no longer requires formats |
| Mobile | both sign sheets accept `serverError`; both agreement screens put the refusal there and keep the sheet open |
| Money | **nothing** |

## Risks

| Risk | Severity | Guard |
|---|---|---|
| A Pay for Content set slips through without content | **High** | `requiresContent` still lists engagement; tested directly, and end to end |
| A Hybrid deliverable that WAS asked for is dropped | Medium | A Hybrid set with formats still produces them; tested |
| The next refusal is invisible again | Medium | Both sheets now render it; tested on the brand's |

## Release classification

**Production-impacting.** One push (Render), two OTAs (brand and creator). No migration.
