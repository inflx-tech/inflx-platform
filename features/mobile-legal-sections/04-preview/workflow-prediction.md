# 04 — Workflow prediction

What `mockups/legal-mobile.html` claims will happen, written before the
implementation so the before/after diff has something to disagree with.

## Mockup

`mockups/legal-mobile.html` — three phone frames at 300px: the follower Legal
list, a document view, and the creator Legal list. Rendered in the same white
and yellow the web legal pages use.

## Predictions

1. **The list reads as a settings screen, not a wall of law.** Two grouped
   cards, each row a title plus one line of plain-English summary. Prediction:
   a shopper scanning for "how do I get my money back" finds it without
   reading anything else.

2. **The difference between the apps is visible at a glance.** The follower
   frame is 8 rows; the creator frame is 10 and its second group is titled
   differently. Prediction: nobody has to be told the sets differ — the screen
   shows it.

3. **Stacked cards beat a table on a phone.** Each table row becomes a card
   with the column heading as a small label above each value. Prediction: the
   Refund policy's seven-row situations table is genuinely readable at 300px,
   which a real table would not be.

4. **The yellow footer block reads as helpful, not as a warning.** It carries
   the "All legal documents" escape hatch. Prediction: it looks like an
   offer of more, not a disclaimer.

5. **Nothing looks unfinished.** Every company fact is resolved at build time,
   so unlike the web pages during their draft phase, there is no placeholder
   treatment to design around.

## Where the implementation is expected to diverge

Recorded in advance so the diff does not read these as defects.

- The mockup uses a system font stack; the apps use their own bundled faces.
- The mockup's back affordance is static text; the real screens use the
  navigator's `goBack`.
- Row summaries in the mockup are shortened by hand to fit the frame; the real
  screens use each document's own `summary` and allow two lines.
- The document frame shows sections 1 and 5 adjacent to demonstrate both a
  paragraph and a table; the real screen renders every section in order.
