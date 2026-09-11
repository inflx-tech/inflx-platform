# item2 — workflow prediction (against the locked mockups)

The locked mockup file is the founder's `INFLX_Item2_Settings_Mockups.html` (copied here unchanged as
`mockups/item2-settings-locked.html`). Predicted behaviour per screen, before implementation:

- **B1/C1** row subtitle is built from the settings summary (`{state} · {aims} · {modes}`); chip green On
  or grey Paused.
- **B2/C2** load with every default; Save grey until a change; picker sheets return "Any" on Clear.
- **B3/C3** every §4 message appears under its field; the bar reads "Fix N thing(s) above to save".
- **B4** Clear → Any; Apply → "N selected" on the row.
- **B5/C5** switch off opens the confirm; nothing changes until confirmed AND saved.
- **B6** after saving paused: toast, grey banner with the open-pitches count, "Paused since {date}", dimmed
  sections, "Open pitches" row → placeholder.
- **B7** list with Unblock (immediate toast); empty state copy exact.
- **B8** skeleton; couldn't-load with Try again; spinner "Saving"; failed-save toast keeps edits; back with
  unsaved changes asks "Discard changes?".
- **C4/C4b** two-step state→city picker; back keeps choices; search shows "{City} · {State}".
- **C6** after saving: toast, "Brands see on your profile" tags, categories, "Your minimums" line,
  blocked brands row.
- **X1/X2** card + enabled button, or one of the two banners with the button off.
- **X3/X4** ⋯ → Block → confirm → toast with Undo.

Deviation recorded: B5 info box reads "Pitches you've already received stay open for you to answer."
(founder, 2026-09-11 — the 30-day rule is not built yet).
