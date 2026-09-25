# item12-content — before / after notes

Plain English, per surface. Screens are added to this file as each phase lands.

## Phase 2a — the brand website goes read-only for content (approval Q2, Q3)

**Campaign page (`/dashboard/campaigns/[id]`), per creator row**
- *Before:* each deliverable row carried **Approve**, **Request revision** (a browser prompt) and
  **Confirm live · release T2**, plus a "View content" preview that fetched the file through the
  legacy media URL. Pressing Confirm live released the second 25% with no shoot, signature or Aim check.
- *After:* one grey card per creator — "Content is reviewed and confirmed in the app." Nothing on
  the page can approve content or move money. The creator's status pill no longer says "N TO
  REVIEW"; the date-change request block (a separate feature) is unchanged.

**Campaign page header**
- *Before:* CONTENT tile — "n to review · n awaiting live · n live", counted from legacy rows.
- *After:* CONTENT tile — "Reviewed in the app / Content is sent, reviewed and confirmed there."
  The AVG ER tile still says "from n live posts" (engagement analytics, not review).

**Command rail (next step bar)**
- *Before:* could offer "Review N deliverables" or "Confirm N live URLs".
- *After:* those two prime actions are gone; the rail falls through to its normal stage.

**Inbox → Content reviews tab**
- *Before:* a list of submitted deliverables, each opening the campaign page's review panel.
- *After:* one sentence — content is reviewed and confirmed in the app. The tab and its count stay,
  so the brand still sees how much is waiting.

**Store Visit panel (campaign → creators)**
- *Before:* item 10 had already made the visit panel read-only; a "Mark visit done" button remained
  in unreachable code, and the card's "Shoot done" line trusted a brand-only mark.
- *After:* the button and its handler are removed; "Shoot done" shows only when the shoot is
  actually complete (`status = 'completed'`), the same test the content step opens on.

**Server side (why the buttons could not simply be hidden)**
All eight `/v1/deliverables` content routes answer `RETIRED_12_*` for every Aim, and
`POST /production-events/:id/complete` answers `RETIRED_12_COMPLETE_VISIT` for a Store Visit.

## Phase 2b — the upload test (a harness, not a product screen)

**Creator app → Profile**
- *Before:* no such row.
- *After:* an **"Upload test"** row — "Checks a large video reaches INFLX from this phone" — that
  appears **only while the server's `CONTENT_UPLOAD_PROBE` switch is on**. Off (the default), the
  row is not drawn and every probe route answers 404. It exists for one job: the real-phone
  200 MB proof the approval asks for before any content screen is written (item 11's "Test
  parcels" is the precedent).

**Upload test screen**
- "Pick a video" (the system photo picker, already in the app) → the file's name, size, type and
  length → **Upload it** (a progress bar, "Keep the app open until it finishes") → a result card:
  *passed* ("Arrived byte for byte: N bytes, video/mp4 · time · deleted") or *FAILED* with the
  reason. **Check the size lock** asks for a URL signed one byte short of the real file; storage
  must refuse it. Nothing is kept either way — the server measures what landed and deletes it.

## Phase 2c — the admin pages

**Admin → Platform settings (C17)**
- *Before:* ten numbers.
- *After:* three more, drawn by the page from the server's list with no page change:
  **Content change requests** (2 rounds, 1–5), **Brand silence before the Creator may report**
  (7 days, 1–30) and **Final payment waiting period** (7 days, 1–60, moved here from Payments).
  Each carries its description, its range and the audit line, like the others.

**Admin → Payments**
- *Before:* "T3 Release After (days)" was an editable number ("Default 30"), read live by the
  tranche-3 job on every run.
- *After:* a read-only row, **Final payment waiting period** — "Moved to Platform settings, where
  every change is recorded…" — with a **Platform settings →** link. The server no longer accepts
  the old field from this page. The T3 release *time* (03:00 IST) stays here, editable.

## Phase 3 — the phone screens

**Creator app — Collabs → a Pay for Content card, after the shoot**
- *Before:* the card opened the shoot screen, whose done state said "Your content step is open" —
  and there was no content step to open.
- *After:* the card's line says her content move ("Upload your content and send it.", "Approved.
  Post it and add the links.", …) and opens **Your content**. The shoot screens' done states carry
  **Go to your content** (on Remote, a secondary button when the return pickup holds the main one).
- **Your content** follows the reissued mockups: C1 (what she owes, usage rights, countdown, Start
  uploading) → C3/C4 (rows, counts grey→green, tiles with the video duration badge, the add tile,
  a caption with its 500 counter, Send disabled with exactly what is missing) → C5 (the send
  sheet: the lock and "Don't post any of this yet") → in review (locked) → C8 (their words
  quoted, the round, notes pinned to files) → C10 (a link field per deliverable, a screenshot per
  story, "I've posted everything" with what is left) → C15 (waiting, and from the stamped date
  "Ask INFLX to look at it") → C12 (the second 25% in, the last on a date). C15's frozen and
  Delayed states, loading and couldn't-load.

**Brand app — Campaigns → set → a Pay for Content row, after the shoot**
- *Before:* the row said where the shoot had got to, and nothing after it.
- *After:* the row's line says where the content is and chips **Your move** when the brand owes
  the review or the confirmation; tapping it opens the content screen, as does **Open the
  content** from the shoot screens' done states.
- The content screen: C2 (waiting, the fee card with the campaign fee as its own line, the
  countdown) → C6 (the round pill, every file and caption, Approve / Ask for changes; a note can be
  pinned to any file) → C7 (the reason, required, 500 counter, the rounds left) → C9 (the last
  round warned before the decision, earlier rounds listed) → C14 (rounds used: approve or report)
  → C11 (every link opens, story screenshots, "Confirming releases ₹3,000 — the second 25% of her
  ₹12,000 fee…") → C13 (completed: three payments, the record, the usage rights) and C16 (Delayed
  with where it stopped, reported with her fee in escrow, nothing received, couldn't load).

**Videos** open in the phone's own player through a 300-second signed link (approval Q11); photos
show in the app. No native module was added — native runtime stays '3', everything ships OTA.
