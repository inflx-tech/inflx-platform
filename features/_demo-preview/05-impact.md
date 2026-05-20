# Impact analysis — _demo-preview

## What changes

Nothing functional. New static files under `features/_demo-preview/`:

```
01-spec.md   02-workflow.md   03-expected-outputs.md
04-preview/README.md
04-preview/workflow-prediction.md
04-preview/mockups/01-follower-public-browse.html
04-preview/mockups/02-search-with-verified-tag.html
05-impact.md
lock.json
```

## Blast radius

Zero. The `_` slug prefix excludes this contract from
`governance-check.mjs:90`'s iteration; the contract never satisfies
the gov-check approved-contract requirement for any other commit
(its `approved: false`). It cannot accidentally become the backing
contract for a production change.

## Reversibility

Delete the folder. Nothing depends on it; nothing references it
from outside `features/_demo-preview/` itself.

## Test plan

`pnpm preview:open _demo-preview` opens an HTML page with both
mockups rendered as iframes + workflow prediction + spec excerpt.
The 2 mockups should visually look approximately like:

1. A follower deal browse screen (mobile, Vijayawada city header,
   3+ deal cards, sign-in CTA at bottom).
2. A brand-web influencer search results page showing both
   "Verified ✓" badged and unbadged creator cards.
