# item4-campaigns-sets — expected outputs

The 20 checks from `PROMPT.md` §12.1 plus the six the founder added (`APPROVAL.md` §4.1). "Proof" names the
automated test; the phone walk is the founder's.

| # | Check | Expected | Proof |
|---|---|---|---|
| 1 | Empty state | "No campaigns yet" with the body line and New campaign; a campaign can be created from it | `item4Brand › C1 · C2` |
| 2 | Campaign saves with a name only; a 201-char description is refused with the exact message | 201 / 422 "Keep it under 200 characters." | `item4-campaigns-sets › campaign: name required…`; `item4Brand › C3` |
| 3 | New set with name, Aim, mode, date; branch required for Store Visit, none stored for Remote | 201; 422 "Pick the branch for this Store Visit set."; `branch_id` null on Remote | `item4-campaigns-sets › set: name, Aim…`; `item4Brand › C4 · C5` |
| 4 | Picker greys out every date before the seven-day mark; cutoff shown = posting − 3 | disabled cells; "Invitations would close …" | `item4Brand › C4 · C5`; `setShape.rules` (client = server constant) |
| 5 | A too-early date sent straight to the API is refused | 422 "Choose a posting date at least 7 days from today." | `item4-campaigns-sets › set: name, Aim…` |
| 6 | Draft set edit/delete; campaign delete while all sets are drafts | 200s; empty draft campaign deletes | `item4-campaigns-sets › a draft set and its campaign can be deleted…`; `item4Brand › C6 · C11 (draft)` |
| 7 | After the first invitation, Aim/date/mode/branch refused by the API and shown locked; rename works | 422 `LOCKED` with the exact message; lock icons; rename 200 | `item4-campaigns-sets › after the first invitation…`; `item4Brand › live and locked` |
| 8 | A set with invitations can't be deleted, nor its campaign | 422 with the two exact messages | `item4-campaigns-sets › a draft set and its campaign…` |
| 9 | Counts right on campaign card, set card, set detail | invited 5 · signed 2 · waiting 2 · declined 1 on all three | `item4-campaigns-sets › invited counts everyone…`; `item4Brand` (C1, C6, C8) |
| 10 | Cutoff, nobody signed → job expires the set, closes open invitations, creators see them as expired | `expired_at` set; open rows → `expired`; `declined` count includes them | `item4-campaigns-sets › nobody signed by the cutoff…` |
| 11 | Cutoff, one signed → set stays live; only unanswered invitations expire (offer clock) | `kept: 1`; open row untouched by this job | `item4-campaigns-sets › one creator signed…` |
| 12 | Expired and completed leave Live and appear under Past / "Show past sets" | tabs.past; `sets.past` | same two tests + `item4Brand › C6 (toggle)` |
| 13 | Draft whose date passed shows the warning; invite refused by the API | chip "Date passed"; 422 "Pick a new posting date before you invite anyone." | `item4-campaigns-sets › a draft whose date passed…`; `item4Brand › date passed…` |
| 14 | Duplicate copies Aim, mode, branch; no creators, invitations or agreements | settings copied, 0 rows in the copy | `item4-campaigns-sets › duplicate copies…`; `item4Brand › C10` |
| 15 | Campaign started from a group shows the group; item 5's picker can read the members | `startedFromGroup {id, name}`; `started_from_group_id` stored | `item4-campaigns-sets › campaign: name required…`; `item4Brand › C3` |
| 16 | Another brand's campaign, set or duplicate → 404 | 404 on the three new endpoints; old ones 403 | `item4-campaigns-sets › another brand gets 404…` |
| 17 | Creators never receive descriptions or draft sets | creator token → 401/403 on the campaign reads | same test |
| 18 | Loading, empty, couldn't-load on list and detail; Try again works | skeleton / empty / LoadError | `item4Brand › C1 · C2` |
| 19 | Brand website and admin still work against the new rules, or breakages listed | no website write into a set remains; two switch-offs done | `05-impact.md`, `06-diff/notes.md` |
| 20 | No new backend failures against the baseline 229 / 901 | see `06-diff/notes.md` | full-suite run + compare |
| 21 | A set where creators declined shows "… · {n} declined" and the bar leaves grey space | line + grey remainder | `item4Brand › copy and counts`, `C1 · C2`; `ProgressBar4` |
| 22 | A creator who declined in Set A can be invited to Set B; a live one cannot | never 409 for dead/deferred; 409 for live | `item4-campaigns-sets › cross-set…` |
| 23 | Deleting a set with any invitation is refused readably; no contract destroyed | 422; contracts count unchanged | `item4-campaigns-sets › a draft set and its campaign…` |
| 24 | Deleting a branch a set names is refused readably | 422 `BRANCH_IN_USE` "A set still uses this branch, so it can't be removed." | `item4-campaigns-sets › a branch a set still names…` |
| 25 | Website invite button and branch editor show their messages; nothing else changed | see `06-diff/notes.md` | manual (parse-checked) |
| 26 | Duplicate copies `channels_json` and the branch, recomputes the rollup, never a duplicate name | channels equal; `campaign_derived` present; "(copy 2)"; 409 on a clash | `item4-campaigns-sets › duplicate copies…` |
