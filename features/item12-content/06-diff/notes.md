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
