# 06 — Before/After · App Builder Phase 1
Before: DB CHECK on section_config.shelf_type (mig 083) rejected tiles/
category_rail/restaurant_list → those sections could not be saved even after
Phase 0's controller fix; no 'business' scope; rules got partial context.

After: migration 119 widens both CHECKs (screen += business; shelf_type += the
3 types) — sections save; 'business' scope exists. Every rule's ctx now carries
scope/vertical/brandId + viewer location + follows (additive). Applier output
confirms the widened constraints on prod.

Verify: pnpm qa GREEN(79); admin-sections 8/8; migration applied+verified.
Backend only, no mobile/OTA.
