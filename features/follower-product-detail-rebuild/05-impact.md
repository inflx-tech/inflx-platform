# Impact — Product Detail rebuild

## Terse verdict
Additive UI on the product page — rating row, hero icons, conditional Customize/Variants,
running-total bar. Buy dispatch + price math preserved. Reversible via OTA.

## Blast radius
- Mobile follower OTA only. NATIVE_RUNTIME '3'. CTA dispatch unchanged; add-ons/size passed
  through to order params (harmless if unconsumed). Rollback = revert + re-publish.

## Verification (honest)
- Babel clean. Conditional blocks hide when no data (most live products have no add-ons →
  block won't show — correct). Founder = on-device gate. Maestro waived via GOVERNANCE_OVERRIDE.
