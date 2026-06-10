# Impact — set format enum validation

**Verdict: validation-only — invalid input rejected earlier with a clear message; valid payloads untouched.**

- Touches: `campaign.controller.js` only (helper + two call sites). No schema change, no migration.
- Brand-web set builder sends valid enum values today, so the live UI sees zero change; the fix protects API consumers and future UI work from the deferred 500 at brand-sign.
- Existing rows with bad types (if any) are not rewritten — they would still fail at sign time; none observed in Phase A or prod reports.
