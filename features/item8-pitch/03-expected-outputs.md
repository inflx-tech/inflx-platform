# Item 8 — expected outputs

The 32 checks from the gap-check prompt plus the nine the founder added (33–41).
Where a check is proved by a test, the test is named.

Suite: `backend/tests/item8-pitch.test.js` (49) ·
`Packages/Mobile/src/screens/influencer/__tests__/item8Creator.test.js` (13) ·
`Packages/Mobile/src/screens/brand/__tests__/item8Brand.test.js` (12) ·
`backend/tests/brief-to-signing.test.js` (the Phase 2a block).

| # | Check | Proved by |
|---|---|---|
| 1 | A brand not accepting, or whose settings she fails, cannot be pitched — from the app and the API | `who may pitch` ×3 (including blocked ≡ paused, byte for byte) |
| 2 | The form offers only the Aims and modes that brand accepts; another Aim is refused with the exact message | `the form offers only…`, `sending an Aim the brand does not take…`, `and so is a mode…`, mobile `offers only the Aims…` |
| 3 | A past creator clears a soft filter, but never paused or blocked | `a past creator clears a soft filter…` |
| 4 | Each Aim carries exactly its own fields | `4. each Aim carries exactly its own fields` |
| 5 | Every numeric limit is item 5's, with the same messages, because it is the same validator | `5. every numeric limit is item 5's…` |
| 6 | A posting date under seven days is refused | `6. a posting date less than seven days ahead…`, mobile `a date inside item 4's floor…` |
| 7 | A second open pitch of the same Aim is refused; a different Aim is allowed | `7. a second OPEN pitch of the same Aim…` |
| 8 | A fourth open pitch to one brand is refused; other brands unaffected | `8. a fourth open pitch to one brand…`, mobile `three open pitches is the limit` |
| 9 | `response_due_at` is stamped at send; the admin number moving does not move it | `9. response_due_at is stamped at send…` |
| 10 | Reminders reach the brand once at 7 days and once at 21 | `10. the brand is reminded once at 7 days and once at 21` |
| 11 | A pitch expires at its deadline, she is told, and may pitch again the same day | `11. a pitch the brand never answered expires…` |
| 12 | A pitch closes early when her date nears, with the exact sentence | `12. a pitch closes early when her date comes within…` |
| 13 | She can withdraw at any point before signing, with no cooldown | `13. she may withdraw at any point…`, mobile `says there is no cooldown before she confirms` |
| 14 | The brand counters: item 6's thread opens with her pitch as turn zero | `14. the brand counters: the thread opens with HER PITCH as turn zero`, `14. she cannot open the thread herself` |
| 15 | The round limit is enforced identically to an invitation | `15. the round limit is item 6's stamped number, not a second one` |
| 16 | **Accepting creates a pool entry and nothing else** — each checked | `16. no campaign, no set, no invitation, no contract, no money`, `accepting twice…`, `accepting THROUGH the thread…`, mobile `T7 — the accept sheet says…` |
| 17 | The entry carries the Aim, terms, date, mode and provenance | `17. the entry carries the Aim, the agreed terms…` |
| 18 | The pool shows pitch entries beside move requests, with the tag | mobile `T11 — the pool tells the two doors apart` |
| 19 | Creating a set from a pitch entry pre-fills Aim, date and mode; the terms screen pre-fills the money | `accept → pool → set pre-filled → invitation…` |
| 20 | She receives an ordinary invitation with the green line | same test (`fromPool.fromPitch`, `pitchLine`) |
| 21 | For a matching set her own five settings do not block her; for a differing set they do | `21. for a MATCHING set…`, `21. for a DIFFERING set…`, `21. a used or expired pool entry…` |
| 22 | A creator who paused, or blocked the brand, can never be invited | `22. paused and blocked always apply, whatever was agreed` |
| 23 | Rejecting stamps the cooldown, tells her the date, shows the brand the date beforehand | `23. rejecting stamps it, tells her the date…`, mobile `T8 — the cooldown date is on the reject sheet BEFORE the tap` |
| 24 | During the cooldown she cannot pitch that brand with **any** Aim | `24. during the cooldown she cannot pitch that brand with ANY Aim` |
| 25 | During the cooldown the brand can still invite her | `25. the brand may still invite her` |
| 26 | Blocking works independently of the cooldown | same test |
| 27 | Withdrawn, expired and date-closed start no cooldown | `27. withdrawn, expired and date-closed pitches start no cooldown` |
| 28 | The brief path no longer creates invitations, and it is stated which | **switched off**, server-side: `brief-to-signing.test.js` → `the brief path is CLOSED (item 8, Phase 2a)` ×3 |
| 29 | Another brand's or creator's pitch, thread or pool entry is 404 | `29. another creator's pitch, and another brand's, are 404 — never 403` |
| 30 | No creator response carries the brand's notes, budgets, other pitches or the reason she failed | `30. nothing she reads carries the brand's filters, budgets or other pitches` |
| 31 | Loading, empty and couldn't-load states on the brand list, both pitch lists and the thread | mobile `an empty list invites her to start one`, `an empty inbox explains how to get more`; every screen renders `Skeleton` / `LoadError` |
| 32 | Backend tests show no new failures against the baseline | `05-impact.md` §1 |
| 33 | The brief path refuses an `agreement_id` at the API, and the eight existing invitations still read | `brief-to-signing.test.js` (18 tests, all passing) |
| 34 | A brand countering on the last day does not leave her a two-day deadline | `34. a brand that counters on the last day does NOT leave her a two-day deadline` |
| 35 | An unmeasured creator sees "Your numbers are still being measured"; the brand still sees three codes | `35. an unmeasured creator is told her numbers are being measured…` |
| 36 | A brand's counter is validated exactly as hers is, with the same messages | `36. a brand's counter is validated exactly as hers is` |
| 37 | Nothing reads `counter_rounds_per_side`; the round limit comes only from item 6's stamped value | `37. nothing in the running code reads counter_rounds_per_side` |
| 38 | The two dead specs are gone, and the baseline is stated before and after | `05-impact.md` §1 |
| 39 | Both admin numbers are on item 6's settings page with their bounds | `39. both new admin numbers are on item 6's settings page` |
| 40 | The pitch notifications are the `pitch.*` namespace and deep-link somewhere real | `40. the pitch notification keys are the pitch.* namespace` |
| 41 | The brand list's SQL and `canCreatorPitchBrand` agree on every reason code | `41. the brand list's SQL and canCreatorPitchBrand agree on every reason code` (11 cases, pinned) |

---

## The one that matters most

Check 16 counts six tables before and after an acceptance — `campaigns`, `campaign_sets`,
`campaign_influencers`, `contracts`, `wallet_transactions`, `escrow_entries` — plus
`collab_agreements`, the destination item 8 retired. Every count is unchanged. Exactly
one `brand_creator_pool` row appears.

That is the spec's one sentence, asserted.
