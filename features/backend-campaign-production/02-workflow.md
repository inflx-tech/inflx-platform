# Workflow — campaign production roster

## Actor
Brand, own campaign.

## Steps
1. GET /v1/campaigns/:id/production → array of active creators with their production state.
2. A creator with no contract/event yet appears with null event fields (not omitted).
3. Another brand requesting the same campaign gets an empty set (ownership is in the WHERE).

## Success
- One call returns the whole campaign roster + production state; ownership enforced.

## Failure/edge
- Not a brand → 403 by role gate. No brand profile → 404. Unknown campaign → empty array.
