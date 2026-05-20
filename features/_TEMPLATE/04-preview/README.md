# Mock UI / Screen Preview (Step 4)

Pre-code visual + behavioural previews live here. The founder
reviews them at the **mockup lock** gate (after spec lock, before
implementation). See sibling files:

- `mockups/` — static HTML files (one per screen / state). Tailwind
  via CDN is fine. Optional `<!-- preview-size: mobile|desktop|WxH -->`
  comment on the first line picks the iframe viewport.
- `workflow-prediction.md` — trigger / steps / end state / edge
  cases / blast radius / what-changes-vs-current.

Run `pnpm preview:open <slug>` to see both rendered together in the
default browser (contract: `features/preview-machinery/`). After
review, set `mockup_locked: true` (+ `_by` + `_at`) in the contract's
`lock.json` and proceed to implementation.

For a worked example, see `features/_demo-preview/`.

After implementation, the real before/after screenshots land in
`qa/artifacts/screenshots/` and are diffed against the locked mockups
in the QA report (sub-contract 2 of Phase 2).
