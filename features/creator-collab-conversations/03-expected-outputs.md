# Expected outputs — creator collab conversations

What must be true when this is done. Each line is assertable; none is a matter of taste.

---

## The reported defect

- **E1** — A creator opens the app, taps **Collabs**, and sees a brand's request on the
  first screen, without entering Profile. Measured on the real production row: Sagar
  Joshi's Urban Roots request appears under **Invitations**.
- **E2** — `viewed_at` on that row stops being NULL once the creator opens Collabs. The
  brand can finally tell "not yet seen" from "ignored".
- **E3** — No path to a collaboration conversation runs through the Profile tab. The
  Profile row survives only as **"Find brands to pitch"**, and it opens a directory, not an
  inbox.

## Threading

- **E4** — A request that produced an agreement that was briefed into a campaign returns
  **one** thread from `GET /collab-threads`, not three. Asserted on a constructed chain.
- **E5** — A cold campaign invite (`agreement_id IS NULL`) returns a thread of one and is
  not merged into anything.
- **E6** — Each thread carries an ordered `timeline[]` in which every entry names who moved
  and what they moved it to. Asserted on the **payload**, not on the query.
- **E7** — A thread appears at exactly one stage. No record is counted under two stage
  tabs, and the stage counts sum to the number of threads.

## Both flows, every state

- **E8** — For each state in `01-spec.md` §1.3, the thread detail offers exactly the
  actions listed for it — no more, no fewer. Sixteen state/action pairs across the two
  tables.
- **E9** — A term marked `requirement` is rendered locked and is **absent from the counter
  composer's fields**, not merely disabled.
- **E10** — When it is the brand's turn, the creator is shown who is being waited on and how
  many rounds remain. No silent dead end.
- **E11** — An agreement in `ready` shows its **expiry date**. A creator can see the clock
  that will lapse their agreement.

## Symmetric negotiation

- **E12** — A creator can counter a brand's counter on their own pitch. `counter_by` reads
  `'creator'`, `creator_rounds_used` increments, and the brand is notified.
- **E13** — The creator's counter is refused once `creator_rounds_used` reaches
  `handshake_settings.counter_rounds_per_side`, with the true reason.
- **E14** — The brand's counter is refused at the same limit. It is unbounded today; a test
  pins the bound.
- **E15** — A counter touching a `requirement` is refused server-side, not merely hidden in
  the UI.
- **E16** — A creator cannot accept or decline their **own** counter. `respondToCounter`
  refuses unless `counter_by = 'brand'`.

## The corrections (each test fails before its fix)

- **E17** — Brand acceptance after a creator counter settles the **creator's latest** terms.
  A test constructs pitch ₹20,000 → brand counters ₹8,000 → creator counters ₹14,000 →
  brand accepts, and asserts the agreement's `terms_json` carries **₹14,000**. Under
  today's code it carries ₹20,000.
- **E18** — Both brand surfaces name the terms on the Accept control ("Accept ₹14,000 +
  6%"), so settling the wrong terms would be visible on screen.

## Convergence

- **E19** — Both directions produce a `collab_agreements` row with exactly one source set,
  and the existing CHECK still holds.
- **E20** — An agreement-backed campaign invite still gets Part 6's one-tap accept with no
  Negotiate, reached now from the thread rather than from a separate list. Part 6's
  behaviour is unchanged, only its entry point moves.

## Not regressed

- **E21** — Threads already in `to_sign` / `active` / `tracking` / `completed` keep their
  stage. Adding two front stages moves nothing that was already past them.
- **E22** — `listCreatorRequests`, `listMyProposals` and `listMyAgreements` keep working
  unchanged. An un-updated app build is unaffected by slices 1–3.
- **E23** — DISCOVER (browse brands, send a pitch) behaves exactly as it does today,
  including the Part 6 category and city facets.
- **E24** — No screen inside the Collabs tab renders in `brandPalette`. Every moved screen
  is `ig`.

## Finding brands

- **E27** — Area filters on `brands.locality`, scoped by city. Filtering "Jubilee Hills"
  returns brands whose `locality` is Jubilee Hills — not brands whose `users.city` happens
  to contain the string.
- **E28** — Locality and industry facets derive from the **same eligibility conditions as
  the list**, so no offered filter returns zero rows. Part 6's rule, extended.
- **E29** — The industry row does not render when the facet has one entry. With the
  fashion-only focus this is the normal case, and a one-option control is not shown.
- **E30** — Every discovery row carries `{ eligible, reason }`. A creator learns they
  cannot pitch a brand **before** writing anything, not after pressing Send.
- **E31** — Ineligible brands appear, greyed, with the reason. They are not filtered out.
- **E32** — Eligibility is asserted on the **response payload**, not on the query.

## Writing a pitch

- **E33** — The pitch aim renders as *Pay per sale · Pay for content · Fee + commission* —
  the same words as the invitation thread, over the same `campaign_goal` enum. No occurrence
  of "ENGAGEMENT (FEE)" or "CONVERSION (COMM)" survives in the creator app.
- **E34** — No new aim enum is introduced. Asserted by test, because Part 2 caught exactly
  this being invented once already.
- **E35** — Every pitch term carries a requirement/preference marker, persisted, and the
  brand's counter is refused server-side when it touches one marked requirement — the same
  rule the invitation direction already enforces.
- **E36** — The pitch payload validates through `collabTerms.model`. A pitch and a request
  are checked by one module, not two.
- **E37** — Step 4 resolves eligibility before Send. A pitch that would be refused on
  submit cannot be submitted from the wizard.
- **E38** — The four steps are navigable both ways without losing entered values.

## Verification honesty

- **E25** — `pnpm qa` green, gate 0, against a baseline of 386. Any failure is classified
  per `feedback_qa_governance` — stale, drift, genuine defect, or bad assertion — never
  re-run until green and never weakened.
- **E26** — Maestro is either run, or recorded as skipped with `released: false` and the
  count of consecutive skips stated plainly. This would be the sixth.
