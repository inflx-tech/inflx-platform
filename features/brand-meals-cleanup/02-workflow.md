# Workflow — meals cleanup (brand)

## Actor
Brand on mobile.

## Steps
1. Brand opens the app → no Meals quick-action on Home; no BrandMealsBoard route exists.
2. Everything else behaves identically.

## Success
- Screen + route + tile gone; no dangling references; tests green.

## Failure/edge
- None — dead-code removal; the screen had no unique API dependency.
