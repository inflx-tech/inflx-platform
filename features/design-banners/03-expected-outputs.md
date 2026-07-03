# Expected Outputs — Banner pack designs

## Per-step expected outputs
| Step | Observable output | How verified |
|---|---|---|
| 1 | announcement_strip + split_banner cards enabled | Playwright e2e |
| 2 | PUT 200, config.style='strip', design set; strip preview | network + Playwright |
| 3 | PUT 200, style='split', ≥2 tiles with per-tile tap_destination | network |
| 4a | image fill → style='fullbleed', shelf_type='tiles' | network |
| 4b | rule fill → shelf_type products + presentation_type banner (unchanged) | network |
| 5 | style='mosaic' + slot_template set; preview reflows | network + Playwright |
| 6 | on-device renders strip/split/fullbleed/slots | Maestro / device |
| 7 | pre-OTA device → carousel, no crash | manual (old bundle) |
| 8 | pnpm qa 79/79 · existing mosaic rows unchanged · Maestro green | QA report + device |

## Data assertions
- Backend accepts style ∈ {strip, split, fullbleed} (422 before enum → 200 after).
- New rows carry config_json.design + matching style; follower payload shape
  unchanged (type='tiles' + config passthrough).
- Existing collage rows (no slot_template) still resolve to design 'collage'
  and render free-form.

## Visual evidence
- before: 04-preview/mockups/ (follower renders of the four additions).
- after: 06-diff/after/ — wizard + phone-pane screenshots (Playwright) and
  on-device shots (Maestro) at the OTA verify step.
