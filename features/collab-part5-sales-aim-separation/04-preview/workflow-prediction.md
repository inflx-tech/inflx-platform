# Part 5 — workflow prediction

What the mockups claim will happen, written before implementation so the before/after diff
can be checked against a prediction rather than against itself.

Mockup: `mockups/sales-aim.html` — 9 panels. Stylesheet and tab script are **byte-identical**
to Part 2's reviewed mockup.

---

## Panel-by-panel prediction

| Panel | Predicts |
|---|---|
| ① Step 1 | The end-date input and the whole "Total campaign budget" input disappear. Step 1 = name, start date, negotiation. No new field replaces them. |
| ② Derived total | Step 2's money strip shows the campaign total as **text**, equal to the sum of paid allocations, with the wallet requirement = total + 8%. No editable total anywhere in the wizard. |
| ③ Review — sales | An all-conversion campaign reads `1 Sep 2026 → ONGOING`, shows no budget row and no wallet card, and lists the set's post-by date + commission + allocation scope. |
| ④ Review — paid | An all-paid campaign shows a derived total **and** a derived end date equal to the latest posting-window end, each labelled as derived. |
| ⑤ Mixed campaign | A campaign holding one conversion set and one paid set reads **ONGOING**; the paid set keeps its own post-by date; products still sell after that date passes. |
| ⑥ End campaign | Campaign detail offers **End campaign** alongside Cancel. The confirm names five consequences, including that creators' products leave the follower app, and that the record will read Completed not Cancelled. |
| ⑦ End refused | Three refusals, each naming its reason: unreleased payment (with the scheduled date), a deliverable awaiting review (named creator), wrong state (draft). The campaign is unchanged in all three. |
| ⑧ Ongoing everywhere | Web detail, web list, and the brand phone screen all render Ongoing. The phone screen also carries End. |
| ⑨ Three clocks | Documentation panel — the post-by / selling / offer-expiry separation, and the trap of conflating the first two. |

## Predictions most likely to be wrong, and how they'll be checked

1. **"No editable total anywhere in the wizard."** The wizard has per-set and
   per-influencer budget inputs that legitimately stay. The prediction is only about the
   *campaign-level* total. P4 asserts absence of the campaign total input specifically, not
   absence of all money inputs.
2. **The derived end date's exact source.** Sets carry both `window_end` and
   `content_end_date`. The mockup says "the posting window closes 25 Oct". Implementation
   must pick one and the test must assert the same one. If they differ in real data, the
   diff notes must say which won and why.
3. **Five consequence lines in the End confirm.** Copy will likely tighten. The binding
   claim is that the confirm states products leave the follower app and that the record
   reads Completed — not the exact line count.
4. **"No wallet card" for sales campaigns.** Part 1 already hides the money card when no
   set needs funding, so this may already be true before any Part 5 code. If so the diff
   notes should credit Part 1 rather than claim it as new.
5. **The phone End button's placement.** Drawn at the bottom of brand campaign detail.
   Real placement depends on that screen's existing action area; the prediction is that End
   is reachable there with the same guards and the same consequence text, not that it sits
   in that exact spot.

## Deliberately not drawn

- The creator's collab-detail screen showing Ongoing (asserted as M2) — the change is one
  word on an existing screen, and panel ⑧ shows the before-state of it.
- Admin surfaces — Part 5 adds no admin-configurable knob.
- The `production.service.js` comment correction (T1) — not user-visible.
