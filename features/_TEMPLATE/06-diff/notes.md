# Diff notes — <feature name>

Agent-authored, plain English. Filled in after implementation +
`pnpm diff:after <slug>` produce the "after" PNGs. Reviewed by the
founder at the diff sign-off gate.

## What was implemented

In one paragraph: what now exists that didn't before. Reference the
real files / endpoints / DB columns that landed.

## What matches the locked mockup

List, per mockup, the visual/behavioural elements that came through
exactly as designed. Be specific (button placement, copy, layout,
state transitions).

- `01-<screen>.html` — <matches: header, primary CTA, list ordering, …>
- `02-<screen>.html` — <matches: …>

## What diverged from the mockup (and why)

Be HONEST. If anything shipped different from the locked mockup,
name it. State the reason (technical constraint, founder mid-flight
decision, mockup oversight). If something diverged silently, that's
a process failure to flag.

- <None>  — preferred outcome, ship the mockup faithfully
- OR
- <Divergence>: <description>. Reason: <…>. Founder agreed:
  <timestamp / how>.

## Things the founder should specifically check

Anything subtle that screenshots might not capture: hover states,
keyboard navigation, mobile-specific gestures, error states, empty
states, race conditions, accessibility, copy tone.

## Out-of-band changes

Anything implemented that wasn't in the locked spec or mockup
(e.g., an adjacent-fix bug found in the same file). Per the
adjacent-fix rule, small in-scope fixes are silent; new behaviour
or new files must be surfaced here.
