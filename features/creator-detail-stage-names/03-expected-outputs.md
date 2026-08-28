# Expected outputs

| # | Assertion |
|---|---|
| S-1 | Every stage `deriveStage` returns is handled by `heroFor` — none falls to the default |
| S-2 | Every stage `deriveStage` returns is handled by `sectionsFor` |
| S-3 | No live stage is described as "closed" |
| S-4 | An **unknown** stage reads as in progress, never closed |
| S-5 | An unanswered invitation offers accept · negotiate · pass |
| S-6 | Terms agreed with no campaign yet offers nothing, and says why |
| S-7 | `shoot` opens the shoot screen |
| S-8 | `done` distinguishes finished (earnings) from cancelled (closed) |
| S-9 | Past signing, she can reach her contract and earnings at every stage |
| S-10 | Every action a hero can emit is handled by the screen |
| S-11 | The real server statuses all map to one of the six |
| S-12 | `Packages/Mobile` jest stays green — currently 44 suites / 507 tests |
