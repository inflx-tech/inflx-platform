# Impact — creator collab conversations

**Verdict:** *not* visual-only. One additive migration, one behaviour-changing backend
correction, and a navigation move that retires two live tabs.

---

## Where the risk actually is

### 1. `acceptProposal` changes what it settles — the one real behaviour change

Today brand acceptance always settles the creator's original terms. After slice 1 it
settles the latest, whoever moved them last.

**Blast radius today: zero.** The new path requires `counter_by = 'creator'`, which nothing
can write until slice 3 ships. Prod currently holds **0 rows** in
`influencer_proposals`. So this is a correction landing ahead of the capability that would
otherwise make it a live bug — deliberately, because shipping the capability first would
arm it.

### 2. Migration 152 — additive, three columns, one backfill

No column dropped, none renamed, no type changed. `counter_terms` keeps its name and gains
a broader meaning. The backfill sets `counter_by = 'brand'` on rows that already have a
counter — true by construction, since no other actor could have written one.

Safe for un-updated app builds: nothing reads the new columns until the OTA lands.

### 3. Two live tabs are retired

`ProposalsHub`'s REQUESTS and MY PITCHES stop existing. Anyone mid-flow when the OTA lands
finds them in Collabs instead. The endpoints behind them are **not** removed, so a phone
that has not updated keeps working exactly as it does now.

The screens are moved and restyled, not deleted — `CollabRequestDetailScreen` keeps its
logic and changes palette.

### 4. Stage model gains two entries at the front

`invitations` and `pitches` join `COLLAB_STAGES`; the old `invites` is absorbed. Because
`deriveStage` maps one record to one stage, and records already past these stages are
untouched, nothing currently in the pipeline moves. Tested as E7 and E21.

### 5. Brand surfaces gain a state they have never rendered

Web and brand-mobile proposal inboxes must handle `counter_by = 'creator'`. Until slice 6
ships they would show a countered proposal with no way to answer — which is why slice 6 is
in this contract and not the next one.

---

### 6. Discovery reads a different column — a behaviour change with a real before/after

Area filtering moves from `users.city` to `brands.locality`. A creator who filtered by city
yesterday and locality today gets a **different result set**, correctly. The eligibility
conditions are untouched, so the filters still only narrow.

Risk is bounded by the pool being one brand. There is nothing to regress yet.

### 7. `accepts_proposals` — the one genuinely consequential decision here

Option A in §1.6 makes every approved brand pitchable in one migration. That is a
**visible, outward-facing change to brands**, who did not ask to receive pitches: 25 brands
go from unreachable to reachable at once, and the first thing some will notice is a pitch
notification. It reverses a deliberate Part 2 asymmetry.

It is the right call in my view — the creator's outbound route has been unusable since it
shipped — but it is the founder's to make, and it should not ride in quietly on a UI
contract. Slice 9 does not start without it.

### 8. The pitch composer changes what is stored

Importance markers are new on a pitch. Existing pitches have none — of which there are
**zero in prod**, so there is no backfill question. The aim vocabulary change is labels
only; the stored `goal` enum is unchanged.

## What is untouched

Contracts, payments, the ledger, deliverables, discovery, allocation, offers, the follower
app. This contract does not touch a single money path: an agreement carries terms, and
money moves only once a campaign and contract exist downstream, unchanged.

`campaigns`, `campaign_sets`, `contracts` — no schema change, no controller change.

---

## Deploy class

**Production-impacting.** backend/src + a migration + brand-web runtime + Mobile runtime.
Explicit founder go required **before** the push, per `feedback_push_is_the_deploy`.

Targets: Render · Vercel · OTA (brand + influencer).

## What could still go wrong, stated rather than smoothed over

- **Threading is derived, and derivation can be wrong.** If an agreement's
  `consumed_ci_id` is set but `campaign_influencers.agreement_id` is not, a thread could
  split in two. Both are written in the same transaction today, so it should not happen —
  E4 pins the chain rather than trusting it.
- **Sixth consecutive mobile release without Maestro.** The screens will be bundle-verified
  only. This one is a navigation change, which is exactly the class of change a device
  catches and a bundle does not — a duplicate route name in a native stack is a hard crash
  on tab mount (`reference_rn_native_crash_debugging`), and this contract adds routes to a
  stack. Worth a device pass even if the rest waits for the end-to-end round.
