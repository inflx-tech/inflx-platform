# Workflow prediction — section-scheduling

Backend-only contract: no UI mockups (mockup-lock gate applies to UI-governed
commits touching `Packages/*`; this contract touches `backend/**` only).

Predicted runtime behavior after implementation:
- Follower app: pages silently gain/lose sections at their schedule
  boundaries within the engine cache TTL (~60s) — no OTA, no app change.
- Admin UI (unchanged in this contract): the existing App Builder keeps
  saving successfully because validation is tolerant of every shape the
  current page emits (`tiles[]`, `nodes[]`, `banner.*`, `hero.*`, `timer`,
  `kind`, raw-JSON edits with unknown keys). The ONLY new rejections are
  objectively broken values (bad enum, non-date timestamp, dangling
  tap_destination) that would already fail silently on device today.
- The P2 wizard exposes starts_at/ends_at date-pickers; until then the fields
  are settable via API only.
