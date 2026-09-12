# item4-campaigns-sets — spec

Rules doc **v1.14** §5, §5A, §5B (new), §6, §11.1, §19, §25, §27, §28, §31. Locked mockups
`04-preview/mockups/item4-campaigns-sets-locked.html` (C1–C11, "Stage 3: locked 12 Sep 2026 · counting
clarified after the gap report"). Gap report `Docs/ITEM4_CAMPAIGNS_GAP_REPORT.md`, approved with nine
answers and three decisions in `APPROVAL.md`. Prompt in `PROMPT.md`.

## What item 4 delivers
The Brand app's **Campaigns tab**: a brand builds a campaign (name, optional description), adds sets that
each carry one Aim, one posting date, one mode of work and, for Store Visit, one branch, and watches each
set until its invitation cutoff. Choosing creators, their terms and sending invitations are item 5; the
"Add creators" button says "Coming soon" until then.

## The rules, as built
- **Campaign:** name required ≤ 60, description optional ≤ 200, never shown to creators. May remember the
  creator group it was started from (G10). Name and description can be changed at any time.
- **Set:** name required ≤ 60 (shown to creators), Aim ∈ Pay for Sale / Pay for Content / Hybrid
  (`goal` conversion / engagement / hybrid), mode ∈ Store Visit / Remote (`shoot_mode` visit / shipment;
  the legacy `remote` is never offered), branch required for Store Visit and must belong to the brand,
  posting date at least **7** calendar days ahead when created or changed (was 5; founder Q1).
- **Cutoff:** posting date − 3 calendar days, **always calculated**; `invites_close_at` is written for
  display and the job's index but never trusted (Q3). A cutoff passes at the end of that day, India time.
- **States (derived; Q2):** Draft = no invitation ever sent · Live = at least one, not expired or
  completed · Expired = `expired_at` set by the job · Completed = at least one invitation, not expired,
  every creator row terminal (`completed | declined | expired | rejected_by_brand | slots_filled`) — a
  stand-in behind one helper until the §19 completion rule exists (Q4). A campaign follows its sets;
  mixed completed + expired counts as completed; no sets = draft. The legacy `campaign_status` enum is
  untouched and `expired` is never written to it.
- **Locks (§28):** after the first invitation, Aim, posting date, mode and branch are refused with
  "This can't be changed after you've sent invitations."; the name still changes. Enforced in one place
  (`campaignState.assertSetEditable`) that every caller goes through.
- **Delete:** a set with any invitation, ever, cannot be deleted; a campaign cannot while any set has one
  (Q8). Where a foreign key would otherwise answer with a database error, a readable message is given.
- **Duplicate (Q5):** copies name-of-choice, Aim, mode, branch, channels, formats, brief, coupon prefix,
  budgets and open-group filters into a new draft with a new posting date. Never creators, invitations or
  agreements. Name made unique; the campaign rollup recomputed.
- **Counts (Q9):** invited = everyone ever invited; signed = both signatures on the contract; waiting =
  `invited | applied | accepted | negotiating | deferred` and not yet signed; declined = `declined | expired`.
  Line: "{invited} invited · {signed} signed · {waiting} waiting · {n} declined"; the bar is green for
  signed, blue for waiting, grey for the rest.
- **Cross-set (Q6):** a creator whose row in another set of the same campaign is dead or deferred can be
  invited again; a live row still blocks. Same fix in the open-group broadcast.
- **Invite refusals:** a draft whose date passed → "Pick a new posting date before you invite anyone.";
  after the cutoff → "Invitations for this set closed on {date}."
- **Expiry job:** hourly, India time: a set past its cutoff with no agreement signed by both sides
  expires; its open invitations become `expired`. A set with one signature carries on.
- **Privacy:** the three new read endpoints answer 404 for another brand; the older endpoints stay at 403 (Q7).
- **Website (APPROVAL.md §2.2, §2.3):** the creator page's "Invite to Campaign" and the profile page's
  branch editor are switched off with a message pointing to the Brand app. Nothing deleted or migrated.

## Out of scope
Choosing creators, terms and invitations (item 5); everything after signing; the delayed-collaboration set;
Home, Wallet, the creator app and every other website screen.
