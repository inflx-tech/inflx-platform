# item4-campaigns-sets — workflows

## W1 — Campaigns tab (C1, C2)
`GET /campaigns/summary?state=live|draft|past` → campaigns ordered by `updated_at`, each with derived
state, set count, next posting date and the four counts, plus tab totals → cards; empty / skeleton /
"Couldn't load your campaigns" + Try again.

## W2 — New campaign (C3)
`POST /campaigns {name, brief?, started_from_group_id?}` → name ≤ 60 / brief ≤ 200 with the exact
messages; the group must be this brand's → draft campaign + `dateRules` → the app replaces the screen
with New set, suggested name "Set A".

## W3 — New set (C4, C5)
Branches from `GET /brands/me/branches` (main first) when Store Visit is picked. Picker floor =
`dateRules.earliestPostingDate` (today + 7 in India); every earlier day disabled; "Use this date"
confirms; the cutoff line appears at once. `POST /campaigns/:id/sets {name, goal, shoot_mode, branch_id?,
go_live_date}` → every rule re-checked on the server (§7 messages, field-addressed) → set written with the
calculated `invites_close_at` and `branch_id` → back to the campaign detail with "Set saved.".

## W4 — Campaign detail (C6, C11)
`GET /campaigns/:id/summary` → campaign (state, counts, `canDelete`, group), sets split current / past
(newest first), `dateRules`. ⋯ → Rename / Edit description (`PATCH /campaigns/:id`, any state) / Delete
(`DELETE /campaigns/:id`, refused with "This campaign has invitations, so it can't be deleted.").

## W5 — Set detail (C7, C8, C9, C10)
`GET /campaigns/:id/sets/:sid/summary` → fields, cutoff, days to cutoff, lock flags, counts, `canInvite`
with its reason and message, `canDelete`, `dateRules`. Draft ⋯: Edit / Duplicate / Delete. Live ⋯: Rename /
Duplicate. Edit = `PATCH /campaigns/:id/sets/:sid`: a locked field that changes → 422 `LOCKED` with the
exact message; name always allowed; a new posting date recalculates the cutoff. Delete = `DELETE …`,
refused with "This set has invitations, so it can't be deleted." Duplicate = `POST …/duplicate {name?,
go_live_date}` → settings-only copy, unique name, rollup recomputed → the new set's detail.

## W6 — Inviting (the item 5 door, guarded here)
`POST /campaigns/:id/sets/:sid/invite` → before any write: date passed → "Pick a new posting date before
you invite anyone."; cutoff passed or set expired → "Invitations for this set closed on {date}."; the
cross-set guard ignores dead and deferred rows. Store Visit eligibility is checked against the set's own
branch city when the set names one.

## W7 — Expiry (job `set-expiry`, `40 * * * *`, Asia/Kolkata)
Candidates: dated, `expired_at IS NULL`, cutoff day ended, at least one invitation. Per set, in one
transaction with `FOR UPDATE SKIP LOCKED`: any contract signed by both sides → keep; else `expired_at =
now()` and every `invited | applied | accepted | negotiating | deferred` row → `expired`. One log line per
changed set; a second run finds nothing.

## W8 — Branch removal
`DELETE /brands/me/branches/:id` → refused with "A set still uses this branch, so it can't be removed."
while any set names it (the foreign key is RESTRICT; the service answers first).
