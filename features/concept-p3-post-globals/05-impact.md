# Impact — concept-p3-post-globals

**Verdict: production-impacting (backend + DB migration + one new admin
page), additive; feed/detail payloads gain fields, nothing reshaped.**

- DB: 3 new tables (one seeded config row; likes/saves empty). No ALTERs.
- Backend: 5 new endpoints (1 public config GET, 1 admin PATCH under the
  existing settings capability, 4 follower-auth engagement). Feed/detail
  queries gain count subqueries + per-caller EXISTS — additive keys only.
- brand-web: /admin/app-settings page + 2 wrappers + 1 nav row (settings cap).
- Mobile: untouched — no OTA. Stage-A screens will consume these.
- Attribution simplification is a RULE (no post-purchase touch calls),
  not a code removal: /follower/touch stays for the legacy app until the
  old follower front end is retired.
- Rollback: revert commit; tables inert without readers.
