# Stage 1 — impact

**One line: a brand's opening move stops being invisible, and both sides can finally
see what was actually offered.**

## What moves in production

| | |
|---|---|
| Both phone apps | Over the air. 17 new routes across two stacks. |
| Backend | Two new read paths for the negotiation history. |
| Database | Migration 155 — approved brands open to creator pitches. |

## Risk, and what is done about it

**Native navigation is the real one.** 12 new routes in a brand-new CreatorsStack and 5
in CollabsStackNav. Two screens sharing a name inside one stack is an uncatchable crash
on tab mount that passes every bundle build first. A check across all 14 stacks is clean,
and it catches that one mistake — not every mistake. **The founder walks it on a real
device before release is claimed.**

**Migration 155 is the only outward-facing change.** Brands are not told; some will first
notice when a pitch notification arrives. Reversible per brand and wholesale. The column
default stays FALSE, so a brand registering tomorrow is opened by approval rather than by
signing up. It carries its own explicit go, separate from the deploy go.

**Safe for phones that have not updated.** The two new read paths are additive and no
shipped build requests them. Migration 155 changes a flag the old app already reads.

## What does NOT change

No campaign building — agreeing produces an agreement, not a campaign. No shoot, no
posts, no completion. No brand web. No role switching inside an app.

## Honest gap

The history page will be **correct and empty** on existing conversations. Recording began
part-way through the platform's life, so the practice conversations have nothing behind
them. It fills the first time a negotiation is walked live — which the test plan does.
