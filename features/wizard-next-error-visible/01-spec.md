# App Builder wizard — "Next · Display" looks unresponsive on step 2

**Reported by founder 2026-07-06:** in the Add-section wizard, step 2
(Content), the "Next · Display →" button "sometimes doesn't respond."

## Root cause

`patch()` (Packages/brand-web/app/admin/sections/page.js:392) was:
`setWiz(prev => ({ ...prev, ...p, err: null }))` — the trailing `err: null`
overrides any `err` the caller spread in. So `next()`'s
`patch({ err: 'Give the section a name…' })` set the message and then nulled
it in the same update. Result on step 2 with an empty Section name: the button
correctly refuses to advance (a section needs a name) but the explanation is
swallowed → zero feedback → looks dead. "Sometimes" = exactly when the name
field is empty. The same swallow silently ate EVERY finish()/Publish
validation message too (bad schedule window, tap-destination, banner headline).

## Fix (admin-web only)

1. `patch = (p) => setWiz(prev => ({ ...prev, ...p, err: 'err' in p ? p.err : null }))`
   — navigation still clears stale errors, but an explicitly-set err survives.
2. Section name input turns red/`bg-red-50` when an error is showing and the
   name is empty, so the cause is visible at the field, not only in the top
   banner.

No backend, no mobile change. Deploys via Vercel on push.
