# Workflow prediction — <feature name>

Before any code: what will this feature *do*, end to end? Discuss
with the founder, then lock alongside the mockups (see sibling
`mockups/`).

## Trigger

What initiates the flow? (User action, scheduled cron, webhook,
API call, app open, etc.)

## Steps

1. <user / system action>
2. <backend / db consequence>
3. <next step>
4. ...

## End state

The observable, verifiable state after success — fields written,
notifications sent, UI states, redirect targets, etc.

## Edge cases

- What if <unauthenticated user>?
- What if <duplicate request>?
- What if <wallet insufficient / stock unavailable / slot full /
  network failure>?
- What if <invalid input>?
- What if <permission denied>?

## What changes vs current behaviour

- Today: <current state, behaviour, or "feature does not exist">
- After: <new state, behaviour>
- Files touched (preview): <controllers, routes, components,
  migrations expected to change>

## Blast radius

- Production-impacting? (Render backend / Vercel web / OTA mobile /
  DB migration?)
- Rollback path?
- Affected users? (All / role-gated / region-gated?)

## Open questions (clear before lock)

- <any genuine uncertainty the founder must decide before code starts>
