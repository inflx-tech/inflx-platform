# item15-hybrid — expected outputs: the checks
Backend `tests/item15-hybrid.test.js` (H); item 14's `tests/item14-sale.test.js` (S); mobile
`src/screens/__tests__/saleLiveScreens.test.js` (M). Status from the full-run compare against
`backend/baseline_item15.json` (= item 14's committed full run).

| # | Check | Proved by | Status |
|---|---|---|---|
| 1 | New-terms Hybrid reaches Going live as Pay for Sale; old-terms told plainly (H1) | H "signing paid the first 25%…", "old-terms Hybrid is told plainly"; S "Hybrid reaches the same two paths" | pass |
| 2 | Path 2 locked until INFLX approves a post | H "signing paid the first 25%; Path 2 is locked…" | pass |
| 3 | Confirm live releases exactly the second 25% and stamps the final 50% at IST day + 7; an amount mismatch moves nothing | H "3, 9 · confirming releases exactly the second 25%…"; M "S3" | pass |
| 4 | Never self-confirms; no `autoconfirm_at` on Hybrid, whatever the jobs do | H "4 · no job ever confirms Hybrid by itself…" | pass |
| 5 | She may tell INFLX only from the stamped date; it freezes nothing; the brand can still confirm and pay | H "5 · she may tell INFLX only from the stamped date…"; M "S1, S5", "S9" | pass |
| 6 | The final 50% is paid on its date with the minimum short (H2); Completed waits | H "6 · minimum short: the final 50% is still paid…"; M "S6, S7" | pass |
| 7 | Completed when paid in full and the minimum approved, whichever is last (job, approval hook) | H "7 · minimum met…", "6 · … Completed waits for the approval that reaches it" | pass |
| 8 | A brand report freezes the step; the job never pays a reported collaboration | H "8 · a brand report freezes the step…"; M "S9" | pass |
| 9 | No campaign fee on Hybrid; the brand wallet untouched by the releases; her wallet + exactly the tranche | H "3, 9 …" | pass |
| 10 | Pay for Content and Pay for Sale unchanged; lists and Delayed follow Hybrid | item 12 and 14 suites green (three drifts recorded); H "the card and the set row say final payment…; Delayed follows Hybrid too" | pass |
