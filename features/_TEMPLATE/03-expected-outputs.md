# Expected Outputs — <feature name>

> Step 3 (cont.). Defined BEFORE coding. This is what the QA report
> asserts against. "Compiles" is NOT an expected output.

## Per-step expected outputs
| Step | Observable output | How QA verifies it |
|---|---|---|
| 1 | | Playwright/jest assertion |
| 2 | | |

## Data assertions (post-workflow)
- DB rows / API responses that must exist with what values
- Money math (rupees), commission/platform-fee/brand_net if applicable
- Attribution IDs present (campaign/set/campaign_influencer)

## Visual evidence required
- before/after screenshots: <which screens>
- network: <which calls must succeed / be intercepted>
