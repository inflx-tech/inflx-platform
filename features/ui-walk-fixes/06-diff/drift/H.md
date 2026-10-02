# Drift — slice H (board H · the file viewer)

## Assertions rewritten

None. No existing test pressed a file tile or pinned `Linking.openURL` on the four content
screens (research C10, "MISSED SITES": *nothing guards today's behaviour*), so the locked board
changed no assertion. Nothing was skipped, deleted or weakened. `components/shop/__tests__/video16.test.js`
is untouched and green — the shopper app's player check and its test seam are the same functions,
now re-exported by `ShopVideo.js` from `utils/videoPlayer.js`.

## After review — this slice's own renewal tests, rewritten (the first build pinned the wrong thing)

The reviewer showed that the first build's renewal tests pinned two faults instead of catching
them. They were this slice's own new tests (nothing older was touched); each line is
test file · test name · what it asserted · what it asserts now · frame.

- `mediaViewer12.test.js` · "an error from the player fetches a new link, reloads and seeks to
  where she was" (now "… hands it to the SAME player, which starts at the second she is at") ·
  asserted a NEW player was mounted (`mounts` 2) and `seek(312.4)` was called after it loaded ·
  now asserts the same player stays on the screen (`mounts` 1, `unmounts` 0), is handed
  `{ uri: <new link>, startPosition: 312400 }`, `seek` is never called, and a spinner shows until
  it plays again · H2 / check 32.
- `mediaViewer12.test.js` · "a video that has moved on since its last renewal may be renewed
  again, as often as it takes" · asserted `seek(i × 300)` after each renewal · now asserts the
  source handed over carries `startPosition: i × 300000`, on one player throughout · H2 / check 32.
- `mediaViewer12.test.js` · "after it has played to the end, a replay on a dead link starts from
  the beginning" · asserted `seek` was not called · now asserts the renewed source has no start
  position at all (and `seek` still is not called) · H2 / check 32.

What moved in the app with them:

- **Where a renewed video carries on from.** The first build remembered only the last second the
  player REPORTED. After a drag on a dead link the player reports nothing from the new place, so
  the video jumped back to where she was before the drag. Now the player itself is asked where it
  is; the last reported second is only the fallback (the player refuses, has no such call, or does
  not answer within 0.8 s).
- **No 0:00 flash.** The second to start at is handed over with the link, instead of loading the
  video at 0:00 and jumping.
- **The same player is kept through a renewal.** The first build took the player off the screen
  and put a new one on. In the player's own full-screen mode that left its black full-screen
  layer on top with the renewed video playing unseen behind it. Now only the link changes, so she
  stays in full screen and the video carries on there. Whenever the player IS taken off the
  screen (another file, "Couldn't load this file", closing the viewer) it is first told to leave
  full screen.
- **Sound.** Frame H2 names "sound" in the bar; the player's own bar has no sound button. The
  viewer now has its own small sound on / off button at the right end of the top bar, on videos
  only. New words (screen-reader labels only): `C12.viewer.soundOff` "Turn sound off",
  `C12.viewer.soundOn` "Turn sound on".

## Tests added (every new behaviour)

- After review: `mediaViewer12.test.js` 24 → 37 — a drag back to 0:40 from 5:30 on a dead link
  carries on from 0:40, and a second failure before it has moved still does · a drag right back to
  the start · a player that refuses / has no such call / never answers falls back to the last
  reported second · "Try again" after giving up picks up where she was · stepping to another file
  while a renewal is waiting does not disturb the other file · a renewal keeps the player on the
  screen and never calls "leave full screen" · giving up, a renewal whose link cannot be fetched,
  closing and stepping all tell the player to leave full screen first · the very same link at the
  very same second gets a new player (the only case) · the sound button turns sound off and on,
  keeps her choice across the row, and is absent on a photo, while loading, on "Couldn't load" and
  on a build without the player. `contentScreens.test.js` +8 → +9 — on the brand's Pay for
  Content review the video is paused while the note box is open over it and plays on when the box
  closes, saved or not (the screen's `held` wiring; before, only the viewer's own test covered it).
  Each fix was checked by breaking it on purpose: every one turns at least one of these red.
- `src/components/content/__tests__/mediaViewer12.test.js` (24) — frames H1–H7 on the viewer itself:
  closed draws nothing · spinner with the top bar and ✕ already there · photo is the core Image,
  `resizeMode="contain"`, `resizeMethod="resize"` · a fresh link on every open and on every step ·
  hardware Back (`onRequestClose`) closes · title "{row label} · {n} of {m}" · previous / next, the
  faded arrow does nothing, one file shows no arrows · "Couldn't load this file" + "Try again"
  (refused, thrown, and a photo that will not draw) · photo-or-video is the server's kind / mime,
  the tile's kind only as a fallback · video uses the player's own controls and is given NO cache ·
  an error from the player fetches a new link and carries on from the same second (see "After
  review" above for how) · two errors from one
  dead link are one renewal · a video that keeps failing without moving stops after two renewals ·
  an app build without the player shows "Update INFLX to play videos" + "Open in browser" (a link
  made at that tap), photos unaffected · "Add a note" / "Remove" / the amber note appear only when
  the caller hands them in.
- `src/components/content/__tests__/videoPlayerCheck.test.js` (7) — the moved check: ShopVideo
  re-exports the same functions · without the native view the module is never loaded · with it,
  loaded once · a throwing check is "no player" · `utils/videoPlayer.js` is the only source file
  that names `react-native-video`, and only with a lazy `require` · the viewer imports no shopper
  code and sets no `bufferConfig` / `cacheSizeMB`.
- `src/screens/__tests__/contentScreens.test.js` (+8, describe "ui-walk-fixes H …") — Pay for
  Content, both sides: tile tap opens the viewer on a freshly fetched link, no menu, and
  `Linking.openURL` is not called · creator editing has "Remove" (closes back to the row, U12) and
  the brand's pinned note · creator in review can only look · her Story screenshot tiles (dead
  before) open read-only · brand review has "Add a note", the note box opens over the viewer, the
  note shows under the file and still travels with "Ask for changes" · no "Add a note" once rounds
  are used · the brand's Story screenshots open read-only and the Instagram link still opens
  outside · a build with the player plays the video in place.
- `src/screens/__tests__/saleLiveScreens.test.js` (+5, describe "ui-walk-fixes H …") — Pay for
  Sale / Hybrid, both sides: the same tap rule · creator editing has "Remove" · creator in review
  can only look · her Story screenshots (package and outside the package) open read-only · the
  brand's review shows the file and NOTHING under it, although it can still ask for changes · the
  brand's Story screenshot opens in the viewer and her link still opens outside.

## The video bar is the player's own — what it has and has not (to be SHOWN at the walk, not assumed)

Frame H2 draws "pause, time played and total, progress, sound" and says the look comes from the
player. Read from the installed player (react-native-video 6.4.5, its Android control layout), the
bar is not only a different look:

- It HAS: play / pause, time played, the progress line, total time.
- It has NO sound button. Sound on / off is therefore the viewer's own button, top right of the
  top bar (not inside the bar as drawn). The phone's volume keys work as always.
- It ALSO has buttons the frame does not draw, and the player offers no switch to hide them:
  previous and next (greyed — there is only one video), back 10 seconds, forward 10 seconds, and
  full screen.
- It hides itself after a few seconds and comes back on a tap on the video.
- Full screen is the player's own layer over the whole phone; the phone's Back button leaves it
  (a second Back closes the viewer). The title, the arrows, the sound button, "Add a note" and
  "Remove" are not visible while it is up.

To try on a phone (none of this can be proven in Jest): play past 5 minutes, drag the bar back →
it should carry on from where you dragged to, without showing 0:00 first, and still be playing if
it was playing; do the same in full screen → it should stay in full screen and carry on; lose
signal in full screen until it gives up → full screen should close onto "Couldn't load this file".

## Behaviour that moved with it (for the walk)

- The small menu ("View" / "Add a note" / "Remove" / "Cancel") on a file tile is gone from the
  brand's Pay for Content review, the creator's content screen and the creator's Going live
  screen. One tap opens the file. "Add a note" and "Remove" are the buttons under the file.
- Seven tile sites that went straight to the browser, or did nothing, now open the viewer:
  creator in review (both screens) · the brand's Story screenshots (both screens) · every file on
  the brand's Pay for Sale / Hybrid review · the creator's own Story screenshots on Content and on
  Going live (package rows and outside-the-package rows — these three were dead).
- The copy key `C12.view` ("View") was removed with the menu; the hard-coded 'View' / 'Remove'
  labels in `SaleLiveScreen` went with it (the viewer uses `C12.remove`).
- New words, all in `C12.viewer`: "Couldn't load this file", "Try again", "Open in browser";
  "Update INFLX to play videos" is the shopper app's own string (`CS.videoNeedsUpdate`), not a copy.
- On the Pay for Sale / Hybrid screens the viewer's title uses the row's heading as the screen
  shows it ("Festive Sarees · K7M2F9 · Instagram reel · 1 of 1"); a long title is shortened in the
  middle so the "n of m" stays readable.
- Superseded text left in place (another contract's record): `features/item12-content/06-diff/notes.md`
  lines ~102–103 and item 12 Q11 ("videos open in the phone's own player"). The stale comments in
  `BrandContentScreen.js` and `components/content/bits12.js` were corrected.

## Correction after the final review — "nothing is stored on the phone" is true of VIDEOS only (spec U26)

This file, the viewer's own comments and two test titles said that nothing of a private file is
kept on the phone. That is true of a video and not of a photo.

- **Video:** the player is given no cache (no `bufferConfig`, no `cacheSizeMB`, no `shouldCache`).
  A private video is never stored on the phone. Rule U8, unchanged, and still tested
  (`mediaViewer12.test.js` "… and NOTHING cached on the phone" — a video test; `videoPlayerCheck.test.js`).
- **Photo:** the viewer draws it with the phone's standard picture component (core `Image`), and
  that component keeps a copy of what it draws in the app's own private picture cache. It is not
  in the gallery and other apps cannot read it, but it IS on the phone until the system clears it.
  The small tiles on the four content screens have done exactly this since item 12; the viewer
  did not add it and did not remove it.
- **Why it is not fixed here:** the installed React Native has no JS switch that stops `Image`
  keeping its copy. Turning it off needs native code, and this contract ships over the air (JS
  only). It goes on the next app-build list.
- **What must not be said:** nowhere — in the app, in a message, at the walk — tell a creator that
  her photos are never stored on the brand's phone. Checked: no sentence in any copy file says so.
- **What changed (closing pass, slice K2):** comments only, no behaviour. `MediaViewer12.js` — the
  header's Photo and Video lines, a new line above the picture, and the line above the player now
  say "videos only" and name U26. `mediaViewer12.test.js` — the header and one inline comment.
  `videoPlayerCheck.test.js` — one test title ("keeps nothing of a private file on the phone" →
  "gives the player no cache — no private video is kept on the phone"); its assertions are
  untouched. Wherever the lines above in this file say "NOTHING cached" or "keeps nothing of a
  private file", read "no video".
