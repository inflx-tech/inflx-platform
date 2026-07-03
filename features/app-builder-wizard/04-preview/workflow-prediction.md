# Workflow prediction — app-builder-wizard

Mockups (04-preview/mockups/, review with `pnpm preview:open app-builder-wizard`
or the live preview panel):

1. `01-shelf-list.html` — App Builder overview: unchanged scope tabs + world
   chips, shelf rows now show the business template name + a schedule chip
   (Always on / Starts … / Live until … / Expired-hidden). Live phone preview
   pane retained.
2. `02-wizard-step1-design.html` — Step 1 Design: 20-design catalog in three
   groups with business names; P3-only designs greyed with a "P3" chip.
3. `03-wizard-step2-content.html` — Step 2 Content: Automatic / My rule /
   My images tabs, gated by the picked design; My rule = the Section Library
   builder inline with live "Matches N products"; saves as a reusable rule.
4. `04-wizard-step3-display.html` — Step 3 Display: placement summary,
   position, enabled, Goes live / Disappears pickers, live-window chip,
   countdown checkbox (same end time — the honest timer from P1).
5. `05-wizard-step4-action.html` — Step 4 Action: Product grid / Category
   page / Custom page radio cards, per-tile note, publish summary.

Predicted runtime behavior after implementation:
- Everything the wizard writes is expressible with TODAY'S backend: legacy
  alias fields + `config_json.design` + `starts_at/ends_at` + existing
  library endpoints. No API, engine, or mobile change; the follower app pixel
  output is identical until an admin uses the new controls.
- Editing any pre-existing section opens the same wizard with values resolved
  through the alias map; unknown legacy shapes fall back to the raw-JSON
  panel (kept from the current builder).
- Retirements alter admin PICKERS only: `top_by_sales` default replaced,
  offer-gated creator twins hidden, Collections preset removed. Saved rows
  keep serving unchanged.
