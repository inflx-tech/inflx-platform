# item2-pitch-invitation-settings — expected outputs

The founder's 17 checks (PROMPT.md §8.2 + APPROVAL.md), each with where it is proven.

| # | Check | Proof |
|---|---|---|
| 1 | New brand: everything open, Save grey; creator sees all Aims/modes + enabled Pitch | `item2-settings-api` A1 GET defaults · A5 pitchSummary OK · mobile `pitchSettings` "skeleton then defaults" · `invitationSettings` X1 OK |
| 2 | Unselect all Aims → error, no save | mobile `pitchSettings` check 2 · backend A1 PUT 422 |
| 3 | IG min 10,000; 8k IG / 12k YT fails until YT min set | `item2-eligibility` §3.1 followers |
| 4 | Fails a filter → criteria banner; API NOT_MATCHING, no threshold | `item2-settings-api` A5 + A7 · mobile X2 NOT_MATCHING |
| 5 | Pause with confirm → "Not accepting"; old pitch still answerable | mobile B5/B6 · backend A5 paused · A7 "settings after a pitch" |
| 6 | Block → identical to paused, no notification, unblock restores | `item2-eligibility` §3.1 rule 1 + summaries · backend A3 no notification row · A5 blocked==paused |
| 7 | Past signed creator passes filters; not if paused | `item2-eligibility` §3.1 rule 3 |
| 8 | Content ₹8,000 · Sale Women 12% · Hybrid ₹5,000 + 10%; Hybrid off/on keeps values | backend A2 example · mobile C6 preview + card off/on |
| 9 | Store Visit on, no cities → cannot save | mobile validation + screen · backend A2 PUT 422 |
| 10 | Watches brand vs Women-only creator → NOT_MATCHING | `item2-eligibility` §3.2 rule 3 · backend A7 invite |
| 11 | Content invite ₹6,000 vs ₹8,000 min → OK + BELOW_MIN_FEE | `item2-eligibility` §3.2 rule 5 · backend A7 invite warnings |
| 12 | Commission row per brand category / ALL row | `item2-eligibility` §3.2 commission |
| 13 | Settings change after send does not touch the pitch/invitation | backend A7 (both) |
| 14 | Load fails → retry; save fails → edits kept | mobile `pitchSettings` |
| 15 | New brand needs ≥1 sub-category | backend "in-scope additions" · mobile/web register forms |
| 16 | Creator profile needs one niche | backend "in-scope additions" · ProfileScreen guard |
| 17 | Women-only creator vs brand with no sub-categories → no match until set | `item2-eligibility` §3.2 rule 3 (check 17) |

Privacy invariant (every A5/A6/A7 response): no `min_*`, `*_codes`, `city_ids`, `block*`, `commission`
key or value; only `OK | NOT_ACCEPTING | NOT_MATCHING`.
