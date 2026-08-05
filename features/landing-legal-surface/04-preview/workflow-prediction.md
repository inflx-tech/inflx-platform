# 04 — Workflow prediction

What the mockups claim will happen, written before implementation so the
before/after diff has something to disagree with.

## Mockups

| File | Represents |
|---|---|
| `mockups/landing.html` | Route `/` — white + yellow, three-sided story, Trust & Responsibility band, full compliance footer |
| `mockups/legal-page.html` | Route `/legal/[slug]` — one template, eleven documents. Shown with the Privacy Policy in it |

Both render at desktop width and collapse to a single column below 900px.
Red dashed spans mark every founder-supplied fact.

## Predictions

1. **The landing page reads as the same product as `/login`.** The palette
   is lifted verbatim from the surfaces already live — `#FFFFFF`,
   `#0A0A0A`, `#FFC107`, `#E4E4E7`, `#FAFAFA` — rather than invented, so
   the seam a visitor crossed at signup disappears.

2. **The yellow does the work of the old gradient without shouting.** One
   accent, used for the headline underline, the primary button, the
   section eyebrows and the step numerals. Everything else is neutral.
   Prediction: it reads as confident rather than as a warning colour,
   which is the risk with `#FFC107` on white.

3. **Eleven documents look like eleven documents.** One renderer means
   identical header, contents rail, table and callout treatment. A reader
   who navigates one has navigated all of them.

4. **The compliance footer is dense but not oppressive** — four link
   columns plus an identity block, then a thinner strip for the grievance,
   customer-care and helpline blocks, then the IP notice at the smallest
   size. Prediction: it reads as a serious company rather than as a legal
   dump.

5. **Placeholders are impossible to miss.** Red dashed monospace against
   otherwise entirely neutral copy. Prediction: nobody looks at a rendered
   page and fails to notice the CIN is missing.

## Where the implementation is expected to diverge from the mockup

Recorded in advance so the diff does not read these as defects:

- The mockups show a schematic mark in the legal-page header; the real
  pages use the shared `Logo` component.
- The mockup footer names sample link groups; the implementation renders
  them from `registry.js`, so the real footer is authoritative and the
  mockup is illustrative.
- The mockup has no grievance intake form. The form was added during
  implementation after research established that an email address alone
  does not satisfy the intake requirement.
- The mockup's landing page has six trust cards; the implementation has
  seven — a shopper-facing commission disclosure was added after
  competitor research found that no comparable Indian platform publishes
  one.
