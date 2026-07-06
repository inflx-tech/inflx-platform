# Before / after — wizard Next error visibility

## Before
- `patch = (p) => ({ ...prev, ...p, err: null })` — trailing err:null clobbered
  any explicit err. Step-2 Next with empty name: no advance, no message → dead
  button. Every finish()/Publish validation message was swallowed too.

## After
- `patch = (p) => ({ ...prev, ...p, err: 'err' in p ? p.err : null })` — nav
  still clears stale errors; explicit errors survive.
- Section name input flags red (`border-red-500 bg-red-50`) while an error is
  showing and the name is empty.

## Verification
- esbuild JSX parse clean. pnpm qa GREEN gate 0. Admin-web only — no backend,
  no mobile, no migration.
