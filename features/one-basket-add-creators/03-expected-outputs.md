# Expected outputs

## Brand app (jest + @testing-library/react-native)

| # | Given | Expect |
|---|---|---|
| 1 | Three ticked on All creators, then switch to Groups | the footer is **still rendered**, reading "3 selected" |
| 2 | Group check, 9 can be invited, 2 already in the basket | button reads **"Add 7 to selection"**, and the overlap line names Priya and Sneha |
| 3 | Tap Add | `addMany` receives the 7, the screen pops back, the footer reads 12 |
| 4 | Tap Add twice (double tap) | still 12. The basket is keyed by creator id |
| 5 | Group check, every one of the 9 already in the basket | button is **disabled**, and says all of them are already selected |
| 6 | Back out of the group check without tapping Add | the basket is exactly as it was |
| 7 | Group with 0 invitable members | button disabled, "nobody from this group can be invited" — unchanged from today |
| 8 | Send a mixed basket | the payload carries `sourceGroupId` on the group-sourced creators and **nothing** on the manual and pool ones |
| 9 | Review sheet | groups the basket by source, and removing one drops it from the footer count |
| 13 | A successful send | the basket is emptied with the draft — she does not return to a basket of people who are now invited |
| 14 | `removeCreators` (Remove n and send the rest) | those creators leave the basket too, not only the draft |

Check 8 is the one that must assert the **payload**, not the screen. A source tag that renders
correctly and is dropped before the request is a bug that looks like a pass.

## Backend (jest, supertest)

| # | Given | Expect |
|---|---|---|
| 10 | `creators[].sourceGroupId` set on 2 of 5 | those 2 rows get `source = 'group'` and that `source_group_id`; the other 3 get `source = 'brand_picker'` and NULL |
| 11 | A per-creator `sourceGroupId` belonging to **another brand** | ignored, stored NULL — same rule the batch-level field already applies |
| 12 | Batch-level `sourceGroupId` only, no per-creator (the old shape) | unchanged behaviour: every row gets it |

Check 12 is the compatibility guard. An app on an older bundle keeps working.

## Regression

Full brand-app suite and full backend suite, before and after, diffed by test name.

```
MOBILE   before  549 passed / 549 total   (fully green)
         after   559 passed / 559 total   — the 10 new checks, 0 broken

BACKEND  before  221 failed / 1096 passed / 1317 total
         after   221 failed / 1099 passed / 1320 total
         newly broken 0 · newly fixed 0 · 3 new, all passing
```

Checks 13 and 14 were not in the first draft of this table. They came out of the build: a
basket that outlives one screen has to be emptied at the right moments, and nothing on any
board says so.
