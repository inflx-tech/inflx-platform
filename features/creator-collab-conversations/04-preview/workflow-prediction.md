# 04 — Workflow prediction (mockup-lock)

Mockup: `mockups/conversations.html`, 10 panels. What a reviewer should observe after
implementation, stated before the diff is captured.

---

## Collabs tab — the reported defect is gone

1. Log in as **Sagar Joshi** (`sagartravel`, influencer `070418e5…`).
2. Tap **Collabs**. First screen, no Profile detour.
3. **Predicted:** an **Invitations** stage tab, first in the row, carrying a count. Inside
   it, a row for the brand behind request `eaff7f85…` reading **15% · post by 24 Aug**, with
   a yellow turn line saying they asked you and the 22 Aug expiry.
4. **Today:** Collabs opens on `All` with no such stage, and the request is three taps away
   inside Profile → Brand Outreach → Brand Proposals → REQUESTS.
5. **Backend-observable, and the sharpest single proof:** `viewed_at` on that row goes from
   NULL to a timestamp the moment step 2 renders. It has never been non-NULL.

## Threading

- A request that produced an agreement that was briefed into a campaign shows as **one**
  row, not three. The row's second line reads the history ("Asked 9 Aug · you countered
  11 Aug").
- A cold campaign invite still shows as its own single row.
- Stage counts sum to the number of threads. No thread is counted twice.

## The two flows

- **Invitations**, `sent`: three buttons — Accept these terms · Counter · Not interested.
  A term the brand marked required renders locked, and is **absent** from the counter
  composer's fields rather than present-and-disabled.
- **Invitations**, `agreed`: no buttons. A green settled block, the agreed terms, and the
  agreement's expiry date.
- **My pitches**, brand countered: three buttons — Accept their terms · **Counter back** ·
  Decline. Counter back does not exist today; the same screen offers two buttons.
- Whenever it is the brand's turn, the screen states who is being waited on and how many
  rounds remain. No silent dead end.

## Find brands

1. Open **Find brands** from the top of My pitches.
2. **Predicted:** an **Area** chip row first (localities within the creator's city, with
   "Change city"), then an **Industry** row — and the Industry row is **absent** whenever
   only one industry has pitchable brands.
3. Every row carries an eligibility line: green "You can pitch this brand", or greyed with
   the reason ("Needs 50K+ followers — you have 48.2K", "free again 12 Sep").
4. **Today:** name search only, no eligibility on any row, and the area filter reads
   `users.city` — which holds "Vijayawada" and "Vijaywada" as two separate chips.
5. **Expect the list to be nearly empty** until the §1.6 `accepts_proposals` decision is
   made. One restaurant is the honest current state, and the screen should look correct
   while showing it.

## Write a pitch

1. Tap a brand → the composer opens on **step 1 of 4** with a progress bar.
2. **Predicted:** the aim options read **Pay per sale · Pay for content · Fee +
   commission** — the same words the invitation thread uses.
3. **Today:** the same enum reads **"ENGAGEMENT (FEE)" / "CONVERSION (COMM)" / "HYBRID"**,
   in a single scrolling form.
4. Step 2 marks each term **Must have** or **Flexible**. No such marker exists today.
5. Step 4 shows the pitch as the brand will see it, plus a resolved eligibility verdict —
   not a criteria card to self-assess against.
6. Stepping back and forward preserves entered values.
7. **Backend-observable:** a pitch whose counter later touches a term marked *Must have* is
   refused server-side by `collabTerms.model`, the same module the handshake uses.

## Brand side

- The proposals inbox renders a creator counter as an old→new diff.
- The accept control names the terms it will settle — **"Accept ₹14,000 + 6%"**, not
  "Accept proposal".
- **Backend-observable:** pitch ₹20,000 → brand counters ₹8,000 → creator counters ₹14,000
  → brand accepts. The agreement's `terms_json` carries **₹14,000**. Under today's code it
  carries ₹20,000.

## Palette

No screen reachable inside the Collabs tab renders in `brandPalette`. The moved screens —
request detail, preferences — are `ig` white/black. A yellow screen one tap inside Collabs
is a failed diff.
