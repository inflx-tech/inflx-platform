# Expected Outputs — App Builder 4-step wizard

> Step 3 (cont.). What QA asserts against.

## Per-step expected outputs
| Step | Observable output | How QA verifies it |
|---|---|---|
| 1 | Wizard modal, 3 design groups, P3 designs disabled | Playwright: group headings + disabled cards |
| 2 | Kind tabs gated per design; Automatic list = business labels | Playwright: tab states + rule labels |
| 3 | Datetime pickers; "Live until" chip after set | Playwright: chip text |
| 4 | Publish → 200; row in list with template name + schedule chip | Playwright + network assert on PUT |
| 5 | Image design → My images tab; per-tile Action picker; publish 200 | Playwright |
| 6 | Inline "Matches N" preview text; publish creates library row + placement | Playwright + network (POST section-library, PUT sections) |
| 7 | Legacy row opens resolved; title-only edit round-trips config_json | network: PUT body deep-equal except title |
| 8 | Inline field error on step 3; no PUT fired while invalid | Playwright + network (no PUT) |
| 9 | Pickers contain no top_by_sales / offer-gated twins / collection preset | Playwright: option lists |
| 10 | Baseline shelves unchanged in preview + follower endpoint | API compare before/after |

## Data assertions (post-workflow)
- New rows in `section_config` carry `config_json.design` (canonical id) AND
  legacy alias fields consistent with the picked design.
- Wizard-created products shelf: `rule='products_in_category'` (never
  `top_by_sales`).
- Rule-section flow: one `section_library` row created; placement references
  it via `config_json.library_section_id`.
- Edited legacy row: all non-title fields byte-identical.

## Visual evidence required
- before: the 5 mockups in 04-preview/mockups/ (Playwright-rendered at
  1440×900 per capture.json).
- after: real `/admin/sections` screenshots of the same 5 states (shelf list,
  wizard steps 1–4) → 06-diff/ with notes.md.
- network: PUT /admin/sections/:screen bodies for steps 4/5/6/7 in the QA
  artifacts.
