# Workflow Definition — <feature name>

> Step 3. The executable contract: each numbered step becomes an
> assertion in the QA workflow test. Define this BEFORE coding.

## Actor
Role + auth state at start (e.g. "logged-in brand, approved").

## Preconditions
Seed/state required (e.g. "one published campaign with an offer").

## Workflow steps (user-observable)
1. User does X →  expected UI/state Y
2. User does X →  expected UI/state Y
3. ...
(Each step = a real user action and the observable result, not an
internal function call.)

## Success definition
The workflow is SUCCESSFUL only if the final state is:
- <concrete end state, e.g. "booking row created with brand_status=pending and confirmation screen shows reference code">

## Failure / edge workflows
- <e.g. "no active campaign → refusal message, no transaction">
- <e.g. "not authenticated → sign-in gate, API not called">
