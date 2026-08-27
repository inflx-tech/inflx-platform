# Expected outputs

| # | Assertion |
|---|---|
| R-1 | The words Fund · Roster · Contracts · Production · Review · Payout appear nowhere in the app as a stage list |
| R-2 | `StageRail` no longer exists |
| R-3 | `CAMPAIGN_STAGES`, `stageIndex` and `stageTrack` no longer exist |
| R-4 | `deriveCampaignStage` no longer returns a `stageKey` |
| R-5 | **The prime action still works**, for every campaign status |
| R-6 | Stage 3's six is untouched and is now the only six |
| R-7 | Both affected tests are **rewritten to the new intent**, never deleted or weakened |
| R-8 | `Packages/Mobile` jest stays green — currently 42 suites / 450 tests |
| R-9 | No import anywhere still points at the old module names |
