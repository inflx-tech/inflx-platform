# Expected Outputs — Hero slider design

## Per-step expected outputs
| Step | Observable output | How verified |
|---|---|---|
| 1 | Hero slider card enabled in wizard step 1 | Playwright (e2e walkthrough) |
| 2 | Slides editor + 1080×560 hint + autoplay field | Playwright |
| 3 | PUT 200 with style/design hero_slider + autoplay_ms + tiles[] | network assert |
| 3b | Phone pane shows real image full-width + dots | Playwright screenshot |
| 4 | Auto-advance ~4s, dots track page | Maestro flow / device video |
| 5 | Slide tap → SectionResults / CategoryBrowser / FollowerPage | Maestro / manual device |
| 6 | autoplay_ms 0 → static | device |
| 7 | Pre-OTA device renders default carousel, no crash | manual (old bundle) |
| 8 | pnpm qa 79/79 · Maestro green | QA report + maestro artifacts |

## Data assertions
- Saved row: `shelf_type='tiles'`, `config_json.style='hero_slider'`,
  `config_json.design='hero_slider'`, tiles carry per-slide tap_destination.
- Backend accepts `style='hero_slider'` (422 before the enum change → 200 after).
- Follower payload unchanged in shape (`type:'tiles'` + config passthrough).

## Visual evidence
- before: 04-preview/mockups/ (follower hero + wizard slides editor).
- after: 06-diff/after/ — App Builder wizard + phone-pane screenshots
  (Playwright) and on-device hero screenshot (Maestro).
