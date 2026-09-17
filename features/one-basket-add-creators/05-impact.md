# Impact

**One line:** all four tabs of Add creators now fill the same basket, so pool + group + manual
go out in one send.

## Blast radius

| | |
|---|---|
| Migration | **none** — `campaign_influencers.source_group_id` is already per row |
| Backend | `controllers/invitations.controller.js` (accept a per-creator source group) |
| Brand app | `BrandSetPickCreatorsScreen`, `BrandGroupInviteCheckScreen`, `draft5.js`, `BrandReviewSendScreen` |
| Creator app | none |
| Web | none |
| Ships as | one push + one brand OTA |

## What could go wrong, honestly

**1. A bigger basket is a bigger mistake.** Today a group send is capped by the group. Once
groups merge into a basket, one Send can carry a lot more people, and the terms screen is
per-creator. The existing over-50 confirmation still stands in the way, so the guard is already
there — but this makes it matter more than it did.

**2. Source attribution gets more truthful and therefore different.** Reports that assume a
whole batch shares one source will now see mixed batches. Nothing reads it that way today
(`invitationRows.service` already returns `sourceGroup` per row), but it is a change in what the
data means, not only in what it holds.

**3. The overlap count is computed on the phone.** It is display only — the server still decides
who may be invited, per creator, and would refuse a duplicate anyway. A stale count would show a
wrong number on the button, never send a wrong invitation.

**4. Older bundles.** The backend keeps accepting the batch-level `sourceGroupId`, so a phone
that has not taken the OTA behaves exactly as it does today.

## Rollback

Restore the two screens. The backend change is additive — a per-creator field nobody sends is a
field nobody notices.
