# Impact Analysis — <feature name>

> Step 6. Generated BEFORE writing implementation code. Reviewed
> against the lock before Step 7.

## Affected files (read or change)
- backend: routes / controllers / services / migrations
- web: pages / components / lib
- mobile: screens / services / navigator
- shared:

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|

## Affected workflows (regression surface)
Existing workflows that touch the same files/routes and must stay green:
- <workflow> — covered by `qa/...spec.ts` / `Packages/Mobile/...test.js`

## Migration / deploy / OTA impact
- New migration? run-NNN.js needed?
- Mobile JS changed → OTA required? package.json/native → APK rebuild?
- Backend/web only → push only?

## Risk notes
- Irreversible/destructive aspects, data backfill, auth changes.
