# creator-handle-change-review — expected outputs

Backend (`creator-handle-change-review.test.js`):
1. Queue row for an unchanged creator: `current_accounts` lists her accounts; `changed` is `[]`.
2. After she changes Instagram A → B and adds YouTube C before approval: `changed` is
   `[{ platform:'instagram', from:'A', to:'B' }, { platform:'youtube', from:null, to:'C' }]` and
   `current_accounts` shows B and C in state `waiting_approval`.
3. Verify → 200 with `record_renamed: true`; `creator_profiles.ig_handle = B`,
   `youtube_handle = C`; both accounts `measuring` / `confirmed`; A's row has `replaced_at`.
4. Verify when another scraped profile already holds B → 200, `record_renamed: false`, the
   claimed profile keeps A, accounts still confirmed.
5. Verify of an incomplete profile → 422 `PROFILE_INCOMPLETE`, nothing renamed or confirmed.
6. `GET /admin/social/handle-checks` rows still carry `old_handle` (unchanged).

Admin (build + manual): the row leads with the current handles; the amber block appears only
when `changed` is non-empty; buttons read "Verify & approve" / "Reject"; `next build` exits 0.
