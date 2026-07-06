# Phase 4c — banner inline matches (D3)

**Program:** Section-rules admin-control program, final sub-release
(founder go "push and start 4c", 2026-07-06).

## Problem
A rule-driven banner proves something matches (Phase 2 hide-when-empty) but
answers "what? from whom?" only after a tap. The founder's model: the banner
face itself should show the matching products and the stores running them.

## Scope
- **Backend (sectionEngine):** the Phase 2 gateway probe runs at limit 3
  (cache key `:preview`, replacing `:exists`) and the matches ride along as
  `items` (≤3) on the emitted `banner_gateway`. Context-aware as before —
  Home shows the world's matches, a business page its own, a creator store
  the creator's allocation (which, after 4b, is live).
- **Mobile (SectionRenderer.BannerGateway):** renders up to 3 matched-product
  thumbnails + a distinct-brands line ("At Charvitha Fashions · Silk Story")
  between the sub-line and the CTA. Absent items (old backend) → the classic
  shell renders unchanged.
- **Contract evolution (documented, not fake-green):** Phase 2's test
  asserted `items: []` on kept banners; 4c intentionally changes that to
  ≤3 preview items — assertion updated in the same change.

## Compatibility & release path
- Old app + new backend: BannerGateway ignored `section.items` entirely
  (verified) — extra payload is inert.
- New app + old backend: `items` absent → preview row simply not rendered.
- Repo push deploys the BACKEND half only (mobile JS ships via OTA).
  **Release to devices = publish-ota (×3 audiences per the established
  strategy) + Maestro on-device green → then flip release.released +
  maestro_green.** No device connected at build time (qa:maestro:doctor RED —
  environment, not code), so this contract ships released=false.
