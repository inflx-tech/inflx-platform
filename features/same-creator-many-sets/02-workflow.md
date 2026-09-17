# Workflow

## Before

1. Brand has a campaign with two sets — Set A "Pay for Content", Set B "Pay for Sale".
2. Asha is live on Set A.
3. Brand opens Set B → Add creators → picks Asha → terms → **Review and send**.
4. Server: `invitationSend.prepareOne` runs the same-set check (clean), then the cross-set
   check (hit) → **409**.
5. Screen: *"1 creator can't be invited · Asha M. (practice) is already in another set of this
   campaign."* Dead end. There is no way to do the thing the rules allow.

Same for open groups: the broadcast excluded anyone live anywhere in the campaign, so Asha
never appeared in Set B's group list either.

## After

1–3 as above.
4. Server runs the same-set check only. Asha is not live in **Set B**, so she passes.
5. The invitation is created. She receives a second invitation, for the Pay for Sale set,
   separate from her Pay for Content one — two collaborations, two agreements, two amounts.

And the set she **is** already on still refuses her: picking Asha again on Set A gives the
same-set 409 it always gave.

## The line that decides

`backend/src/services/invitationSend.service.js`

```sql
SELECT 1 FROM campaign_influencers
 WHERE set_id = $1 AND influencer_id = $2 AND status = ANY($3::campaign_influencer_status[])
```

`set_id = $1`. That is the entire rule now. Before, a second query widened `$1` to the whole
campaign.

`backend/src/controllers/campaign.controller.js` — the open-group broadcast exclusion, same
correction: `ci2.set_id = $n` where it used to join up to `campaign_sets` and match
`cs2.campaign_id`.
