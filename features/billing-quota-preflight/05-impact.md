# Impact — billing-quota-preflight (A12.1.5)

## Changes
- 1 middleware refactored (`quotaCheck.js`) — `evaluateQuota` extracted; checkQuota calls it. Same exports.
- 1 controller function added (`subscription.controller.quotaPreflight`).
- 1 route mounted in `brand.routes.js`.
- 1 api client method added.
- 2 frontend pages modified to wire entry buttons.

## Blast radius
- Middleware refactor: same exports, same behaviour. checkQuota now thin (delegates to evaluateQuota + throws on block). All 4 routes that use the middleware unaffected.
- New endpoint: net-new under `/v1/brands/me/quota-preflight`. No conflict.
- Frontend page changes scoped to 2 files; only entry-button click handlers changed; nothing else on those pages touched.
- QuotaWallModal already imported on both pages (A9 wiring); products page already rendered it; campaigns page now renders it too.

## Rollback
Revert the commit. Entry buttons go back to plain Link/onClick. Submit-time gate still works.

## Risks
- **Fail-open posture** — if preflight errors, page opens the form anyway. Submit-time gate catches over-quota. Worst case = same as pre-A12.1.5 behaviour.
- **Race between preflight and submit** — brand opens 2 tabs, preflights both, both pass, both submit → 2nd one hits the submit gate. Acceptable; rare.
- **Preflight cost on every click** — one round-trip per click. Endpoint is cheap (one DB read + entitlements service cache). Acceptable.

## Pre-push checklist
1. pnpm qa main GREEN.
2. Backend boot smoke (`node -e require('./src/app')`) clean.
3. gov-check Rules 1+3+4.
