# Impact

**One line:** a creator can now be on more than one set of the same campaign, which the rules
always said she could; being on the *same* set twice is still refused.

## Blast radius

| | |
|---|---|
| Migration | none |
| Backend | `services/invitationSend.service.js`, `controllers/campaign.controller.js` |
| Mobile | none — the phone never enforced this, it only printed the server's refusal |
| Web | none |
| OTA | **not needed** |

## Who is affected by the loosening

Nobody retroactively. This only changes what a **new** invitation is allowed to do. No existing
row changes state, no money moves, no notification fires.

## What could go wrong, honestly

A brand can now invite the same creator twice over in one campaign — three sets, three fees.
That is the rules' intent (§148 names different Aims and different negotiated arrangements as
the reason), but it does mean a careless brand can double-book someone. The guards that remain:

- her own invitation settings still refuse per set (item 2),
- each set has its own posting date and cutoff, so a clash is visible to her,
- she can decline any of them.

The platform does not, and per the rules should not, decide for her that two is too many.

## Rollback

Restore the deleted `crossSet` block and the `campaign_id` form of the broadcast exclusion.
Nothing persisted depends on the change.
