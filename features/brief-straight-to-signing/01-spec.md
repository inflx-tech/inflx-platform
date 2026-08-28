# The brief goes straight to signing

**Founder, 2026-08-28, after briefing a real creator from his phone:**

> *"in creator app, when i send detailed campaign to one creator, it is sitting in collab tab
> instead going for signing tab... it should contain all details of campaign clearly which
> includes pre campaign agreement and campaign other details and ask for signing contract...
> **when i click on it it is opening blank page.**"*
>
> *"set information in creators app is not required, this is the brands one, just campaign name
> is enough."*
>
> *"your recommendations is fine...**with clear remarks from creator**."*

---

## 1 · What was actually happening

He briefed a creator he had **already shaken hands with**. She had agreed the money, the date and
the working style weeks earlier. The app then asked her to agree again:

| Step | What she saw | Why |
|---|---|---|
| 1 | The brief landed in **Invitations** | briefing wrote `status = 'invited'` |
| 2 | She taps it → **blank page** | the detail screen did not know the stage |
| 3 | She "accepts" terms she had already accepted | a second handshake nobody asked for |
| 4 | *Then* a contract is drafted | the only step that was ever needed |

Steps 1–3 exist because briefing was built before agreements were. Once two people have agreed
terms, **the next thing either of them owes the other is a signature**, not another yes.

## 2 · What changes

Briefing a creator whose agreement is **clean** now creates her contract `pending_influencer`
immediately and moves her row to `accepted`. She appears under **To sign**, with a contract to
read and sign — one step, not four.

⚠️ **Only when the agreement is clean.** The server already computes `agreement_warnings`
("they will have to agree again") when the campaign drifts from what was agreed. On a drifted
agreement she still goes through the old accept-first path, because a contract built on terms she
never saw is not something she should be asked to sign. Nothing had ever acted on those warnings
before; this is the first thing that does.

If contract creation fails for any reason, the brief **falls back** to the old path rather than
being lost.

## 3 · The sign screen shows the whole deal

Three things she was being asked to sign **without being told**:

**What she can sell.** Her entire commission depends on which of the brand's products count. The
brand picks it in the set wizard, it is stored on her row, the storefront reads it, the payout
maths reads it — and no creator-facing screen had ever shown it to her.

**The offer her shoppers get, and how long it runs.** Batch B gave every creator her own offer
with its own valid period. She could see neither. An offer that expires before her post does is
something she has to be able to read *before* she signs.

**What happens to her content.** The founder's clause: her content may be reposted on the
brand's and INFLX's own social accounts, with credit, and nothing more. If the brand bought
commercial rights at the handshake, the same sentence says so and names the money.

All three are described **on the server** — `describeAllocation()` and `describeUsage()` — so the
contract screen, the collab screen and the brand's own screens cannot end up saying different
things about the same row. Four surfaces describing one deal four ways is the fault this repo has
already paid for three times.

## 4 · She can say no

Under the old flow she accepted a brief first and the contract arrived afterwards, so the sign
screen only ever needed one button. Now **the contract IS the brief** — this is the first and
only place she is asked to commit, and a screen offering no way to refuse is not asking, it is
telling.

Sign, or decline with a reason and **her own words** (`declined_note`, migration 163). Optional
on purpose: making her explain herself before she may say no would be the platform taking the
brand's side. The category tells a brand which box she ticked; *"the store visit is 40km from
me"* tells them something they can fix.

One `DeclineSheet` component, shared by both screens.

## 5 · Two live bugs fixed on the way

* **`not_a_fit` was never a valid reason.** The server takes `not_relevant · fee_too_low ·
  schedule_conflict · already_partnered · other`. The collab screen's "Not a fit" button returned
  a 422 **every single time anyone tapped it.** The five keys now live in one exported list.
* **An invalid enum write was nearly shipped.** Declining tried to `UPDATE contracts SET status =
  'cancelled'` — `contract_status` has no such value, so it throws at the database and leaves her
  declined with a live contract attached. Replaced with a guarded DELETE of the unsigned
  contract. ⚠️ **The identical bug still exists in `cancelInfluencer` and is carried, not fixed
  here.**

## 6 · Out of scope

* The screens that let a brand **ask for** commercial usage — the term exists
  (`features/commercial-usage-term`) but nothing offers it yet
* `cancelInfluencer`'s invalid enum write — confirmed, carried
* The campaign screen rebuild
