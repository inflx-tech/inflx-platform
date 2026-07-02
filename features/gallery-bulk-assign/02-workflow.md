# Workflow Definition — Gallery Bulk-Assign (E-4)

## Actor
Logged-in brand on the gallery (Brand Assets).

## Workflow steps (user-observable)
1. Brand ticks the corner checkbox on several assets (or clicks "Select all") → a bulk bar shows
   "N selected".
2. Brand picks a category (Logo / Brand kit / Product shot / Video / Document / Other) and clicks
   Assign → that category tag is added to every selected asset.
3. The grid reloads; the chosen category chip's count goes up and those assets now appear under it.
4. Brand clicks a category chip → sees the assets they just organized there.
5. "Clear" deselects; changing the filter clears the selection.

## Success definition
- A brand can categorize many assets in one action; the category tabs actually fill up.

## Failure / edge workflows
- No category chosen → Assign disabled.
- An asset already in the category → union avoids duplicates.
- An update fails → error banner shown, no crash; successfully-updated assets keep their new tag.
