# Before / After — brand mobile IG-clean shell

**Before:** the brand tab bar used **emoji as static `<Text>`** (🏠📣💰🔔👤) — they ignored
active/inactive state completely — over a white bar with an **orange** active tint that
matched nothing else in the product.

**After:** the IG-clean shell, identical to the shipped influencer app — white surface,
hairline top border, **MCI vector icons** (home · bullhorn · wallet · bell · account) that
take the active colour, **black active / grey inactive**, consistent label sizing. Unused
`Text` and `colors` imports removed.

## Changed
- `navigation/BrandNavigator.js` — tabIcon helper + Tab.Navigator screenOptions + imports.

## Verification
- **Mobile jest 103/103 green** (22 suites) — no regressions.
- Verified in the founder's single E2E pass.

## Known delta / deferred
- Brand screen **bodies** (headers, cards) still use the old palette — a later screen-by-
  screen slice.
- **ActionRequired deliberately NOT refactored into a router**: it is a legitimate
  cross-campaign inbox (the same judgement made on web A3, where the signature strip was
  kept). Refactoring would risk working bulk-sign for modest gain.
