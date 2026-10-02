# Drift — slice J (board J · live links)

## Assertions rewritten

None. The two tests that pinned these screens at the posting step —
`contentScreens.test.js` "C10 · approved: a link per deliverable, a screenshot for the story, and
what is left" and `saleLiveScreens.test.js` "S14, S15 · approved: a link each, then the date it
confirms itself" — pass unchanged (an empty box still means a grey button and the "… to go."
line, frame J1). Every other test in both files passes unchanged too, including
"C5 · 28 · the send sheet…", which presses Send and expects the sheet. Nothing was skipped,
deleted or weakened. `content12.test.js` (the word-for-word check against the server) is
untouched and green: the three new sentences are in `C12` / `C14`, none in `MSG12`.

## Behaviour that moved (for the walk) — what a test did NOT pin before

- **When a link is sent.** Before: only when she left the box. Now: at once on a paste, 0.7 s
  after she stops typing, on the keypad's Done key, on leaving the box, and when she leaves the
  screen. (J2 · research C11 FIX FINAL 1.)
- **What the box shows.** "Saving…" at its right end while it is on its way; a tick beside the
  box when INFLX has the link; the existing red line (and a red outline) when refused. Once
  saved, and while she is not in the box, the link is shown short ("instagram.com/reel/C8xK2…"),
  as the board draws it; in the box she sees and edits the whole link. (J2, J3, J4.)
- **When "I've posted everything" can be pressed.** Before: only when the server said every proof
  was in. Now: as soon as every PACKAGE link box has text and every Story has its screenshot, and
  no link has been refused. Pressing it closes the keypad, finishes the saving, and only then
  marks it posted; if a link is refused it stops with the red line on that row. The server's own
  rule is unchanged and still refuses the step if a link is missing. (J2, J4, U13.)
- **The line under the button.** Before: only "… to go.", counted by the server. Now, in this
  order: "… to go." (counted from the boxes — a box with text no longer counts as missing) ›
  "One link needs fixing — see above." › "Saving your link…". (U13.)
- **"https://".** A link typed or pasted without it gets it before it is sent (D5). Anything that
  already names how it opens ("http://…") is sent as it is and the server still refuses it.
- **Captions.** Pressing "Send to …" now saves a caption she is still in before the sheet opens;
  if INFLX refuses it the sentence shows on its row and the sheet stays shut. A caption she
  typed and never left is also sent when she leaves the screen. A caption's refusal is now cleared
  when she types again (before, it stayed until she added a file).
- **Order.** Every save on the two screens, and every other call that answers with the whole
  content (the read on opening the screen, Send, "I've posted everything", adding or removing a
  place), now goes out one at a time, in order. With nothing in front of it a call still leaves
  the moment it is asked for.
- **Posts outside the package (J7).** The same self-saving box with the tick. No "Save link"
  button (the copy key `C14.saveLink` stays, unused, as before). These links never count toward
  the button or its line; "Add where you shared it" is untouched.

## New words (all approved on the board's last section, row J)

`C12.saving` "Saving…" · `C12.savingLink` / `C14.savingLink` "Saving your link…" ·
`C12.linkNeedsFixing` / `C14.linkNeedsFixing` "One link needs fixing — see above."

## Tests added (every new behaviour)

- `src/components/content/__tests__/linkBox12.test.js` (20, new file) — the box and the line of
  saves on their own: "https://" added, trimmed, a link that already says how it opens left alone ·
  no list of allowed sites in the app · the short form is the brand's link line's own · the box
  empty / saving / saved / refused · typed text waits the 0.7 s, each keystroke restarts it, Done
  and leaving the box send at once, and blur + end-editing + Done are one save · an emptied box
  clears the link · the second save is not sent until the first has answered and the first answer
  does not empty the second box · a read asked for while a save is on its way waits its turn · a
  call with nothing ahead of it starts at once, and one that throws does not stop the line · an
  answer about text she has since changed eats no character · a refusal for changed text is held
  back, and the same refused text is not sent twice · a save that got no answer is tried again ·
  "save everything now" waits for every answer and says what INFLX still does not have · leaving
  the screen sends what is unsaved.
- `src/screens/__tests__/contentScreens.test.js` (+15, describe "ui-walk-fixes J …") — her
  content screen: J1 as locked · a paste is sent without leaving the box, "Saving…", the button
  on, then the tick, the green count and no line (check 34) · typing, Done, leaving the box ·
  "https://" added and an emptied box cleared (D5) · refused: red line, grey button, "One link
  needs fixing — see above." (check 34) · a late refusal is held back · pressing the button with
  an unsaved link: keypad closed, link saved, then posted, in that order (check 35) · pressed and
  then refused: it stops, nothing posted · no signal is not a refusal and the button retries · two
  boxes, one at a time, both stay filled (check 36) · two reels and a Story: the counting line
  wins over the fixing line (J5, U13) · leaving the screen inside the 0.7 s · a caption typed
  just before Send is saved first; refused, the sheet stays shut (check 37) · an unchanged
  caption sends nothing.
- `src/screens/__tests__/saleLiveScreens.test.js` (+8, describe "ui-walk-fixes J …") — Going
  live: one saved, one saving, the Story without its screenshot → "1 screenshot to go." (J6) ·
  the last package link pasted turns the button on while it saves, a refusal turns it off · an
  outside link saves by itself with the tick, there is no "Save link", and neither an empty nor a
  refused outside box holds the button (J7, check 35) · an outside link does not stand in for a
  package link · pressing with an unsaved package link saves, then posts · pressed and refused:
  it stops · a package link and an outside link together, in order (check 36) · a caption typed
  just before Send (check 37).

Each new behaviour was broken on purpose once (paste, the order of saves, "text she has since
changed", "the same value twice", leaving the screen, outside rows counting, posting without
stopping on a refusal, opening Send without saving the caption, closing the keypad, the button
reading only the server, a refused link leaving the button on, the order of the line): every one
turned at least one of these tests red.

## After review — one finding, real, fixed (no assertion rewritten)

**Found:** on Going live, a row she takes out before sending is deleted on the server together
with its caption, and the next row she adds is handed the SAME key (`saleLive.service.js`
`removeRow`, `nextRowKey` = highest + 1). The line of saves remembered "INFLX has this caption for
s1" from the old row, so the same words typed again on the new row were judged already saved:
wiped from the box, never sent, and the Send sheet opened without them. Reproduced in a test before
the fix (caption call count 1 instead of 2). A second leak of the same kind was found while
reproducing it: a caption still being typed when she pressed Remove reappeared in the new row.

**Fixed, in two places:**
- `bits12.js` · `useSaves12` — "INFLX already has this" is now believed only while the content the
  screen is showing and the last save from that box AGREE. When they differ (the content changed by
  another road) her text is sent, never wiped. A remembered refusal is likewise kept only for the
  content it was given against. New `forget(key)`: her unsaved text, the red line and everything
  remembered about a box go.
- `SaleLiveScreen.js` · Remove — when INFLX accepts the remove, the row's caption box and link box
  are forgotten in the remove's own turn of the line (so a save queued behind it sends nothing for
  the row that is gone). A refused Remove forgets nothing.

Not changed: her content screen (its rows cannot be taken out); the server.

**Behaviour that moved with it:** in the rare moment when the screen and the last save disagree, a
link or caption equal to either one is sent once more instead of being skipped — a harmless repeat
(the server upserts), chosen over ever skipping a save that was needed.

**Tests added (+8; phone suite 1395 of 1395):**
- `linkBox12.test.js` (+4): a link INFLX no longer has is sent again when the same link is pasted ·
  when screen and last save disagree nothing is taken as already saved · a refusal is asked again
  once the content has changed · `forget(key)`.
- `saleLiveScreens.test.js` (+4, describe "a row taken out and added again is handed the same key"):
  the same caption typed again on the new row is sent again, on Send and on leaving the box, and is
  never wiped (check 37) · a caption still being typed when the row is taken out does not reappear
  in the new row and nothing is sent for it · a caption box left while Remove is on its way sends
  nothing for the row that is gone · a refused Remove keeps her caption and still sends it.

Each part of the fix was broken on purpose once (believing the old save; the refusal guard;
`forget` not dropping her text / the red line / the refusal; no `forget` on Remove; `forget` on a
refused Remove; `forget` after the remove's turn instead of inside it) — each turned a test red,
files restored byte-for-byte. One line is not pinned by a test: `forget` also stops the box's
0.7 s timer; without it the timer fires and finds nothing to send, so nothing visible changes.
