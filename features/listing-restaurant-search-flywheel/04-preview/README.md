# Mock UI / Screen Preview (Step 4) — Restaurant dish search + flywheel

Review at the **mockup-lock** gate (after spec lock, before implementation).

- `mockups/01-dish-search.html` — seller typeahead: fuzzy "Did you mean Dahi Vada (86%)" + persistent "Add 'Perugu Vada' as your own dish", with the existing cuisine→category browse preserved below.
- `mockups/02-custom-dish-live.html` — added-dishes list: custom dish kept verbatim with a "NEW · pending review" chip; goes live immediately.
- `mockups/03-admin-dish-queue.html` — admin queue: link-as-alias / promote / reject, with the flywheel "auto-promote candidate" flag at ≥5 restaurants.
- `workflow-prediction.md` — trigger / steps / end state / edge cases / blast radius / open questions.

Run `pnpm preview:open listing-restaurant-search-flywheel` to render mockups + prediction together. After review, set `mockup_locked:true` (+`_by`+`_at`) in `lock.json` and proceed.
