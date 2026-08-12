# Part 5 — impact

**Chat verdict (one line, per `feedback_impact_terse`):** two questions leave campaign
creation and become computed, one new deliberate End action is added, and open-ended
selling becomes real — no migration, no money-path change.

---

## Blast radius

| Area | Change | Risk |
|---|---|---|
| `campaigns.total_budget` | Written by the server from set allocations instead of typed | **Low** — column and every reader unchanged; all 10 prod rows are already NULL |
| `campaigns.end_date` | Written by the server, or left NULL for anything containing a sales set | **Medium** — genuinely new data (0 NULL rows today); mitigated by the §2 read-path audit and D1–D5 |
| Campaign creation (web) | Two inputs removed from Step 1; two validations become unreachable | Low — fewer states, not more |
| `POST /campaigns/:id/end` | New endpoint | Low — additive; guards mirror the cron's existing rules |
| Discovery | Unchanged code; new *data* shape (NULL end date) flows through it | **Medium** — the reason D2 pins the NULL clause as an invariant |
| Money | **Nothing.** Wallet lock, escrow, tranches, platform fee, commission untouched | None |
| Migrations | **None** | None |

## What becomes impossible (by construction, not by suppression)

- *"Total set budgets exceed campaign budget by ₹X"* — the total **is** the sum.
- *"Window end cannot be after campaign end"* — the last paid window **is** the end.
- The publish-time `end_date` gate the first draft proposed — never needed: a paid set
  always has a window.
- A brand inventing a deadline for a campaign that has none.

## What becomes possible that was not

- Selling that continues past the posting deadline (the actual point of a sales campaign).
- Closing a campaign deliberately, recorded as **completed** rather than **cancelled**.

## Deliberate consequences, stated rather than discovered

1. **Ending removes creators' products from the follower app** and stops their links
   selling. Correct, irreversible-ish, so the confirm text says it in those words and the
   creators are notified.
2. **A mixed campaign never auto-completes.** Any sales set keeps the campaign open, so the
   brand closes it by hand. Verified safe: tranche 3 keys off `triggered_at`, not campaign
   dates, so payments are unaffected.
3. **`production.service.js`'s visit-window fallback** stops claiming a campaign always has
   an end date — this contract makes that false on purpose. Behaviour already correct
   (falls back to a year out); only the comment was lying.

## Regression posture

The 7 live prod campaigns are all dated conversion campaigns with no budgets. Nothing in
this contract rewrites existing rows — derivation applies on set save. So those 7 keep
their dates and behave exactly as today until the brand edits them. R1–R3 assert it.
