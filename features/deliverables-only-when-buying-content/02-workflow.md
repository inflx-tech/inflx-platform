# Workflow

## Before

```
brand briefs Asha (commission campaign, formats_json = [])
  -> she signs
  -> brand taps "Counter-sign Contract"
  -> 422  "campaign set has no deliverable formats"
  -> DEAD END. The deal cannot be completed at all.
```

## After

```
brand taps "Counter-sign Contract"
  -> plannedDeliverables(goal, formats)
       goal is conversion  -> { formats: [], error: null }   -> contract goes ACTIVE, 0 deliverables
       goal buys content   -> formats present  -> deliverables created
                           -> formats empty    -> 422, in the brand's own words
```

## What she then sees

```
signed, no deliverables, no shoot arranged
  -> "You are live — share your link and earn on every sale it brings"
  -> tracking · earnings · contract · terms all reachable

signed, no deliverables, a store visit or parcel exists
  -> "The shoot" — unchanged, because that is real work
```

## Expected end state

A brand can counter-sign a commission deal, and the creator it belongs to is told she is selling
rather than told to attend a shoot that does not exist.
