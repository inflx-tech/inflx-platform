# item5-invitations — spec

Rules doc **v1.16** §7A (amended 12 Sep 2026 after the gap check), with §5, §5A, §5B, §7, §8A, §15.1,
§21, §25. Locked mockups `04-preview/mockups/item5-invitations-locked.html` (I1–I15, "Stage 3: locked
12 Sep 2026", updated with the "Asked for another date" group on I9 and the Closed state on I15). Gap
report `Docs/ITEM5_INVITATIONS_GAP_REPORT.md`, approved with twelve answers and five further decisions in
`APPROVAL.md`. Prompt in `PROMPT.md`.

## What item 5 delivers
A brand puts creators into a set (the item 3 Discover list in select mode, Worked with, or a whole
group checked member by member against the set), agrees each creator's own terms by the set's Aim, gives
each an optional follower offer, reviews, and sends every invitation in **one all-or-nothing action**.
Sending makes the set live and locks it (item 4). The set then shows its creators grouped by what is
happening, with withdraw and remove. The creator sees one invitation with the brand's fixed terms and her
own kept apart, and accepts, counters (item 6's placeholder) or declines with a reason.

## The rules, as built
- **Who may be picked:** approved creators who pass the item 2 checks **for this set** (open, not
  blocking, Aim, mode, brand category, the set's branch city for Store Visit). Ineligible rows show
  "Can't invite" with "Not open to this set"; a creator live in the set shows "Invited"; the real reason
  is never sent. A dead, withdrawn, removed or deferred row never blocks a fresh invitation.
- **Terms per Aim (§7 messages, server and app identical):** Pay for Sale: commission required,
  0 < x ≤ 100, one decimal; selling scope (whole store / one category / chosen products); optional
  offer; shoppable posts shown read-only ("1 post · set by INFLX", `config/platformRules.js`). Pay for
  Content: fee in whole rupees > 0; deliverables ≥ 1 row, count 1–20, no repeated type; note ≤ 300;
  usage rights off by default, 30/60/90 days or forever, at least one place. Hybrid: fixed fee > 0 plus
  everything for Pay for Sale, no content package. Above 50% the app asks once; the server accepts.
- **Minimums (item 2):** returned to the brand only; a fee or commission below them warns on the terms
  screen and on Review and never blocks.
- **Send (Q2):** one request; the set is checked once (a posting date, not expired, date not passed,
  cutoff not passed — exact messages); every creator is prepared before any write; if any fails nothing
  is written and every failure is named; Review offers "Remove {n} and send the rest". One transaction
  with the set row locked; notifications after commit; the campaign rollup once.
- **One service for every door (APPROVAL §4.2):** `services/invitationSend.service.js` — the batch
  send and the legacy brief (`POST …/invite`) both go through `prepareOne` + `insertOne`.
- **After sending:** terms are never edited (`updateInfluencer` refuses every row with the §7
  message, §3.2). Withdraw only while `invited`; remove until both signatures, deleting an unsigned
  contract, never a signed one, never money. Both tell the creator plainly with no reason.
- **Statuses:** `withdrawn` and `removed` added (migration 181, Q1); every dead-status list learned
  them; `deferred` is no longer waiting, is never closed by the set-expiry job, and sits under "Asked
  for another date" (Q5). New invitations offer Accept, Counter and Decline only.
- **Decline (Q3):** one of fee_too_low / schedule_conflict / not_relevant / too_much_work / other, a
  note ≤ 200, `answered_at`; the brand's notification carries the reason and the note.
- **Creator's view (D14):** never the campaign description, the budgets, the coupon prefix, the group,
  who sent it, other creators or the brand's warnings; the branch's city only. The two legacy creator
  endpoints were stripped of the same fields (Q7). Ended, withdrawn and closed cards move to Done after
  seven days.
- **Counter (§3.4):** shown only when `canCounter` is true (cold invite, negotiation allowed, handpick,
  no thread); it opens a placeholder and writes nothing.
- **Offers (§15.1):** none / a saved offer snapshotted at send / a special offer (money off, buy more
  save more, buy one get one; "applies to" hidden for BOGO; optional "also save to my offers"); dates
  default to the posting date with no end. **Gap A:** the sale records the winning offer's id.
  **Gap B:** an offer never applies, or is advertised, before its start date.
- **Set summary (A9, §3.5):** the creators grouped in the I9 order, at most 50 per group with the real
  count and "+{n} more".
- **Privacy on the new endpoints:** another brand's campaign or set, another creator's row → 404.
