# creator-handle-change-review — workflow prediction

Mockups: `mockups/creator-handle-change-review-mockups-v1.html` (V1, V2; locked 19 Sep 2026).

| Screen | Predicted | Built as |
|---|---|---|
| V1 the row | current channels large and linked; amber "changed since signup" block with old → new lines only when changed; signup-profile facts underneath; Verify & approve / Reject | `app/admin/influencers/page.js` `ClusterCard` + `ProfileRow`, reading `current_accounts` and `changed` from `GET /admin/creator-verifications` |
| V2 after Verify | green line naming the channels; record renamed | verify response `record_renamed`; toast on reload |
| Handle checks | the same old → new line | shared `HandleChange` component |

Deliberate departures: none.
