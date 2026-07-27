# Impact
**Frontend-only, mobile (brand) — OTA. Zero backend.**
Reuses brandApi.getProposalSettings / updateProposalSettings. Payload shape matched to the
web panel so both surfaces write identical data.
Risk: low — one settings write, validated, with accepts_proposals preserved.
