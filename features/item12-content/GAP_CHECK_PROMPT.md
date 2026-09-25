# INFLX — Item 12: Pay for Content, from the shoot to the last rupee

## Phase 1: gap identification (backend, database, frontend, admin, storage)

You are working in the INFLX codebase:

- the backend (Node, `backend/src/**`, migrations in `backend/migrations/**`, scheduled jobs in `backend/src/jobs/**`);
- the Brand and Creator phone apps (`Packages/Mobile`);
- the admin website and the brand website, which share the same backend.

Three files come with this prompt:

1. **`INFLX_Master_Business_Rules_Phase_1_v1.28.docx`**: the business rules.
   - **Main section:** **12.2 (Pay for Content, written out today)**.
   - **Related:** 3 (the campaign fee, charged once, never to the creator), 7A (the deliverable rows), 9 (the agreement, usage rights, what is stamped), 10 (funding), 11, 11.1 and 11.2 (the shoot that opens this), **19 (completion)**, 21 (the payment model), **22 (Pay for Content in detail)**, 24 (Needs You), **25 (the deadlines and the stamped numbers)**, 26 (disputes), 27 (the content-review states), 28 (locks), 31.
2. **`INFLX_Item12_Content_Mockups.html`**: the **locked** mockups, screens **C1–C17**, plus the rules table at the end of that page.
3. **This prompt.**

**Order of authority:** rules doc → mockups → this prompt. If two disagree, stop and ask. Never guess.

> **This session is Phase 1 only.** Read and report. Do **not** change code, run migrations or edit data. Do **not** submit, approve, reject, confirm, report or complete anything in **production**, and **do not move, release or unlock any money anywhere**. Write the gap report (§10), then **stop and wait for approval.**

---

## 0. How to work

- **The repo is the truth.** Items 2–11 were built before this one; earlier reports are guides only. Cite **`file:line`** for every claim.
- **Items 10 and 11 have just been built.** Read them as they now stand and reuse rather than rebuild:
  - `shootGate` / `assertShootOpen` and how every path asks it;
  - how the shoot records completion — item 10's brand confirmation or auto-confirm, item 11's creator mark — and exactly what item 12 must read to know the shoot is done;
  - `campaign_influencers.delayed_at` / `delayed_stage`, the widened CHECK, and the Delayed job;
  - the 48-hour reminder lane and how item 11 added its arm to it;
  - `productionCopy.js`, the per-item `notify` wrapper and the notification keys;
  - the Needs You rule and both sides' counts;
  - `platform_settings` / `_audit` and the data-driven admin page;
  - the compare-and-swap write pattern, `FOR UPDATE SKIP LOCKED` jobs, notifications after commit;
  - `DangerButton` and the `busy` rule;
  - **item 11's file handling**: how a label PDF is stored and served (`storage.service.js`, `pdf.service.js`, signed URLs) — item 12 stores far more, and far more private, files.
- **Item 9's money is the ground here.** This is the first item since item 9 to release a creator payment. Report the escrow and tranche machinery in full: what a tranche is, how tranche 1 was released at signing, what `escrow_entries` and the creator ledger hold, what `contracts.locked_amount` means now, and exactly what a tranche-2 and tranche-3 release must write. Report anything that already releases them, correctly or not.
- **Something already exists here.** There is content-submission code in the repo from before the rebuild (content submissions, reviews, approvals, "content live" flags — find their real names). **Map all of it before proposing anything**, and say for each part whether item 12 keeps, extends or retires it.
- **Storage is new ground.** Creator media — photos and videos up to 200 MB — has never been uploaded by a creator before. Report what storage exists (R2 or otherwise), how files are uploaded today, whether uploads go through the API server or direct to storage with a signed URL, size limits anywhere in the stack (Render, body parsers, nginx, the client), and what a private-by-default object looks like.
- **Migrations:** additive only. Find the next free number yourself. Dry-run and print counts.
- **Server enforcement:** every rule below is enforced on the server, not only in the app.
- **Phone apps** ship over the air. Flag any new native module. The likely ones: picking photos and videos from the gallery, showing a video, and taking or picking a screenshot. Item 7 found **no file-viewing module** and item 11 found **no picker** in the binary — check again and say plainly what is and is not OTA-safe, with the fallback if it is not.
- **Tests:** record the backend baseline first as `baseline_item12.json` and use `backend/scripts/compare-tests.js` (committed in item 11). Item 12 must add no new failures.

### Words: rules doc vs code

| Rules doc / mockups | Code (verify) |
|---|---|
| Creator | `influencer` |
| Collaboration | a `campaign_influencers` row with a signed `contracts` row |
| Deliverable row | the content types and counts agreed in item 5 and stamped on the agreement |
| The package | one submission covering every deliverable row |
| A round | one change request by the brand |
| Content live | the brand's confirmation that the posted content is up |
| Second 25% / final 50% | item 9's tranche 2 and tranche 3 |
| Admin numbers | `platform_settings` + `platform_settings_audit` |
| Delayed | `campaign_influencers.delayed_at` / `delayed_stage` |
| Dispute | recorded only; item 18 handles it |

---

## 1. Aim of this item

### 1.1 In one sentence

Item 12 lets a creator **upload the content she agreed to**, as one complete package, lets the brand **approve it or ask for changes within an Admin-controlled number of rounds**, lets her **post it and prove it**, and lets the brand **confirm it is live** — which releases the **second 25%**, starts the waiting period, and ends in the **final 50%** that completes the collaboration.

### 1.2 What it delivers

1. **The content step**, opened by a completed shoot and nothing else.
2. **Uploads**: photos and videos against each deliverable row, with a caption, private to that collaboration.
3. **One complete submission**, locked while under review.
4. **The review**: approve or change, a required reason, per-file notes, the round limit stamped at first submission, the warning on the last round, a dispute recorded beyond it.
5. **Posting**: a public link per row, a screenshot for a Story, her confirmation.
6. **Confirming live**: the second 25% released, the waiting period stamped, no auto-confirm, and her right to tell INFLX after an Admin number of days of silence.
7. **The final 50%** by job, and **Completed**.
8. **Delayed** with the content stages, **Needs You**, **reminders**, **notifications**, **two new Admin numbers**.

### 1.3 Why it matters

It is the first item where a creator's work is judged, the first to hold creator media, and the first since item 9 to move money to a creator. It is also the machinery items 14 and 15 will reuse for Pay for Sale and Hybrid, where the same confirmation releases Hybrid's remaining 75%.

### 1.4 Out of scope

- Shoppable posts and follower commerce (items 13–16).
- §12.1's Pay for Sale and Hybrid version of this step (items 14 and 15). **Report what they will share so they extend rather than copy.**
- Dispute handling (item 18). Item 12 **records** a dispute and stops.
- Any change to what was agreed: the deliverable rows are fixed at signing (§22).
- Checking whether content stays live after the waiting period starts.

---

## 2. Screen inventory (locked mockups)

| ID | Screen | App |
|---|---|---|
| C1 | The content step opens: what she owes, usage rights, countdown, Start uploading | Creator |
| C2 | The brand waiting, with the fee card and the two payments ahead | Brand |
| C3 | Nothing uploaded yet: the rows, the limits, Send disabled | Creator |
| C4 | Filling it: counts per row, captions, Send still disabled with what is missing | Creator |
| C5 | The send sheet: what goes, the lock, "don't post any of this yet" | Creator |
| C6 | Reviewing: files, captions, the round pill, Approve or Ask for changes | Brand |
| C7 | Asking for changes: required reason, 500 characters, the rounds left | Brand |
| C8 | Changes requested: their words, pinned notes, the package open again | Creator |
| C9 | The last round, with the warning about what comes after it | Brand |
| C10 | Approved: posting, a link per row, a screenshot for the story | Creator |
| C11 | Confirming live: the links, the screenshots, and the money the button moves | Brand |
| C12 | Paid the second 25%, waiting for the final 50% on a date | Creator |
| C13 | Completed: three payments and the record | Brand |
| C14 | Rounds used: approve or report, with both rounds' history | Brand |
| C15 | Creator · every other state: waiting to be confirmed, they reported, delayed, shoot not done | Creator |
| C16 | Brand · every other state: delayed, reported, nothing received, couldn't load | Brand |
| C17 | Admin: the two new numbers beside the existing waiting period | Admin web |

The rules table at the foot of the mockups is part of the requirement.

---

## 3. How item 12 links to the rest

Report each row as **ready / not ready**, what is missing, and what item 12 must consume or expose.

| Link | What must be true |
|---|---|
| **Items 10 and 11: the shoot** | One reliable "is the shoot done" test covering both modes. Report it, and confirm nothing else can open the content step. |
| **Item 9: the money** | Tranche 2 and tranche 3: what is written, what the creator's ledger and wallet do, what `locked_amount` does, and whether anything deducts a fee (it must not — §3). Report every existing release path and whether any of them could fire for Pay for Content today. |
| **Item 7: the agreement** | Where the deliverable rows live after signing (`terms_json`?), their shape, whether the content type carries a platform, and the usage rights. **If the type list has no platform, say so plainly** — C10 and C11 depend on it. |
| **Item 5: the terms** | The content-type list as item 5 built it, and what a row looks like (type, count). |
| **Item 10: Delayed, reminders, Needs You, copy, jobs** | Exactly how each is built, so item 12 adds an arm rather than a second mechanism. |
| **Storage** | Where files go, private by default, how they are served to two parties and to Admin on a dispute, and the upload path for a 200 MB video from a phone. |
| **Item 18: disputes** | What "record a dispute" should write so item 18 finds it: the trigger, who raised it, when, and the evidence. Report anything dispute-shaped that exists. |
| **Items 14 and 15** | What §12.1's step will share with this one — the same submission and review machinery, the same confirmation releasing Hybrid's tranches. |
| **Notifications** | The service, the keys that exist, and the per-item wrapper. |
| **Admin website** | The settings page, and anything that shows content or approvals today. |
| **Existing production data** | Signed Pay for Content collaborations; how many have a completed shoot; any content-submission rows that exist; any collaboration already marked content-live or completed; any tranche 2 or 3 already released. |

---

## 4. Data requirements

For each item report status (**E** exists / **P** partial / **M** missing / **C** conflicts), evidence (`file:line`), and a proposed change.

### D1. The content step

One per collaboration. Derive the stage from timestamps, as items 10 and 11 do; do not invent a status vocabulary.

| Field | Rule |
|---|---|
| Opened | Derived from the shoot being done. Nothing is created before that. |
| Rounds allowed | Stamped from the Admin number at her **first** submission. |
| Submitted at / resubmitted at | Per round. |
| Approved at, approved by | One moment, the whole package. |
| Posted confirmed at | When she said she had posted. |
| Report-after days | Stamped from the Admin number when she confirms she posted. |
| Live confirmed at, confirmed by | The brand's confirmation. |
| Final-payment due at, waiting days | Stamped at that confirmation. |
| Tranche 2 released at, tranche 3 released at | From item 9's machinery. |
| Completed at | When tranche 3 is released (§19). |
| Reported at, reported by, reported kind | `rounds_used`, `posted_wrong`, `brand_silent`. Recorded for item 18. |
| Delayed | Item 10's flag, with the content stages of D7. |

### D2. The deliverable rows

Read from the agreement, never editable here. Report where they live, their shape, and whether the type names a platform. Propose how a row is identified so files, links and counts can hang off it.

### D3. The files

| Field | Rule |
|---|---|
| Row | Which deliverable row it satisfies. |
| Kind | Photo (JPG, PNG, ≤ 10 MB) or video (MP4, ≤ 200 MB). Validate server-side, not only in the app. |
| Count | At most 10 per row. |
| Caption | Per row, optional, ≤ 500 characters. |
| Round | Which submission it belongs to; earlier rounds are kept, never overwritten. |
| Storage key, size, type, uploaded at | Private object; a signed URL to view. |
| Brand's per-file note | Optional, with the round it was written in. |

Report how a file is uploaded from the phone without passing a 200 MB body through the API server, and what limits exist today.

### D4. Submitting and the review

| Rule | Detail |
|---|---|
| Complete or not at all | Every row at its count, or the submission is refused (§22). |
| Locked while reviewing | She cannot add, replace or remove. |
| One verdict | Approve the package, or ask for changes with a reason ≤ 500 characters. |
| Rounds | The stamped number, two by default. Every round kept with its reason and its files. |
| The last round | The brand is warned before it decides. |
| Beyond the rounds | Approve or report. A third change request is refused by the server. |
| Idempotency | Two taps, or two devices, produce one submission, one verdict, one confirmation. |

### D5. Posting and proof

| Field | Rule |
|---|---|
| Link | One public URL per deliverable of that row. Validate the shape; do not fetch the page. |
| Screenshot | For a Story row, a photo instead of a link. Report how to tell a Story row from the type. |
| Posted confirmation | Hers, once every row is proved. |
| Brand's verdict | Confirm live, or report `posted_wrong`. No third answer. |

### D6. The money

| Movement | Rule |
|---|---|
| Second 25% | Released at the brand's confirmation, from the locked amount. |
| Final 50% | Released by a job at the stamped due, from the locked amount. |
| Nothing deducted | The creator receives both in full (§3). |
| Nothing else | No other movement exists in item 12. Prove it. |

Report how each release is written in item 9's ledger, what the creator's wallet shows, and what happens to `locked_amount` when the last tranche goes.

### D7. Delayed

Item 10's job and flag. Content stages: `content_not_submitted`, `content_in_review`, `content_changes_requested`, `content_not_posted`, `content_not_confirmed`. Report whether the `delayed_stage` CHECK allows them — item 11 widened it once, and `content_not_live` already exists; say which of these five are new.

### D8. Needs You and reminders

Creator: send your content; make the changes; post it and add the links. Brand: review the content; confirm it is live. Reminded at 48 hours through item 10's lane. Report what each count filters on today and what must change.

### D9. The Admin numbers

| Number | Default | Stamped |
|---|---|---|
| `content_change_rounds` | 2 | At her first submission |
| `content_report_silence_days` | 7 | When she confirms she posted |
| Final-payment waiting period (existing) | 7 | At the brand's confirmation |

Report the existing waiting-period key and whether anything reads it today.

### D10. Privacy

The files and captions belong to that collaboration: the owning brand, that creator, and Admin only when a dispute is raised. Report every endpoint that could serve a file to anyone else, and how signed URLs expire.

### D11. Notifications

Needed: content submitted; changes requested; changes sent; approved; posted; content live; final payment released; collaboration completed; reported to INFLX; delayed. Report the keys that exist.

### D12. Legacy data

Any existing content-submission rows, approvals, or collaborations already marked live or completed. What each would show on the new screens. **Prefer no backfill.**

---

## 5. API requirements

Follow existing naming. Propose request and response shapes and error codes. Say for each whether it exists, needs extending, or is new. **Every one** behind the signed-and-funded gate, the "shoot is done" test, and the Aim check (Pay for Content only); brand endpoints for the owning brand, creator endpoints for that creator, everything else 404.

| ID | Endpoint | Screens |
|---|---|---|
| G1 | **The content state**, both sides: rows, files, captions, round, verdicts, links, money, what this side can do now. | C1, C2, C8, C12–C16 |
| G2 | **Upload a file** (signed URL or direct), with kind, size and row validation. | C3, C4 |
| G3 | **Remove or replace a file** before submitting. | C4 |
| G4 | **Save a caption.** | C4 |
| G5 | **Submit the package** — refuses an incomplete one; stamps the rounds at the first submission. | C5 |
| G6 | **Approve.** | C6, C9, C14 |
| G7 | **Ask for changes** — reason required, per-file notes, refused when the rounds are used. | C7 |
| G8 | **Add a link or screenshot** per row. | C10 |
| G9 | **Confirm she has posted** — refused until every row is proved; stamps the silence period. | C10 |
| G10 | **Confirm the content is live** — releases the second 25%, stamps the waiting period. | C11 |
| G11 | **Report to INFLX** — `rounds_used`, `posted_wrong`, `brand_silent`. Records only. | C11, C14, C15 |
| G12 | **View a file** — a short-lived signed URL, for the two parties and Admin on a dispute. | C6, C11 |
| G13 | **Admin: the two numbers.** | C17 |
| J1 | **Job: release the final 50%** at the stamped due; complete the collaboration. Idempotent, logged. | C12, C13 |
| J2 | **Job lanes extended**: Delayed with the content stages; the 48-hour reminder lane with the five content moves. | C15, C16 |

Every write is compare-and-swap. G10 and J1 take the money rows `FOR UPDATE` inside their transaction.

---

## 6. Business rules and screen behaviour (exact)

### 6.1 It opens (C1, C2)

- Creator: green "Shoot done on {date}. Now the content."; the step line; a locked card of the deliverable rows and the usage rights; the posting countdown; the grey line "Upload everything here first. {Brand} see it before it goes anywhere, and you post once they approve."; **Start uploading**.
- Brand: the step line; blue "{Name} is working on the content. You review it here before she posts anything."; the fee card — 25% paid on signing, 25% when they confirm, 50% after the waiting period — and the countdown.

### 6.2 Uploading (C3–C5)

- Empty: "Nothing uploaded yet" with the counts and the limits in one sentence.
- Each row: its name, "{n} of {m}", the files as tiles with a duration badge on videos, an add tile, and the caption field with a 500 counter.
- **Send** is disabled until every row is at its count, and the hint says exactly what is missing.
- The send sheet lists what goes, the blue lock line "You can't change anything while they are reviewing it.", and "Don't post any of this yet. They approve it first, then you post and they confirm it is live."

### 6.3 The review (C6–C9)

- Brand: amber "Your move. {Name} sent her content on {date}."; the round pill; every row with its files and caption; grey "Approving locks this as the version she posts. Asking for changes sends it back with your reason."; **Approve the content** and **Ask for changes**.
- The change sheet: the round pill, "What should change?" required with a 500 counter, blue "You have {n} rounds. After that you can approve it or report it to INFLX."
- Creator: amber "{Brand} asked for changes on {date}."; their reason quoted; per-file notes in amber; the package open again; **Send the changes**.
- The last round: amber "This is the last round. If this still isn't right, you can approve it or report it to INFLX — there is no third round.", with the earlier rounds listed.

### 6.4 Posting (C10, C11)

- Creator: green "Approved on {date}. Post it now — this is the version they approved."; per row, a link field for each deliverable, and for a Story row a screenshot upload with "Stories disappear in a day, so a screenshot is the proof."; **I've posted everything**, disabled with what is left.
- Brand: amber "Your move. {Name} posted everything on {date}."; every link, tappable; the story screenshots; the green preview "**Confirming releases ₹{n}** — The second 25%. The last ₹{n} follows {m} days later."; **Confirm the content is live** and the quiet **Something's wrong — tell INFLX**.

### 6.5 The money (C12, C13)

- Creator: green confirmation line; the fee card with the second payment paid; blue "₹{n} is in your wallet. The last ₹{n} arrives on {date} — nothing for you to do."; the step line.
- Brand: green "Collaboration completed on {date}."; all three payments; the record card — shoot, content approved with the number of rounds, posted with the number of links, confirmed live, paid in full; and the usage-rights line.

### 6.6 Everything else (C14–C16)

Copy exactly as the mockups: rounds used; waiting to be confirmed with the date from which she may tell INFLX; reported by either side; Delayed with where it stopped; nothing received; the couldn't-load state.

---

## 7. Validation and messages (server and app, identical text)

| Field / action | Rule | Message |
|---|---|---|
| Shoot not done | Server | The shoot isn't done yet. |
| Not Pay for Content | Server | This collaboration doesn't use this step. |
| File too large (photo) | ≤ 10 MB | Photos have to be under 10 MB. |
| File too large (video) | ≤ 200 MB | Videos have to be under 200 MB. |
| Wrong file type | JPG, PNG, MP4 | Send a JPG, PNG or MP4. |
| Too many in a row | ≤ 10 | You can add up to 10 to one deliverable. |
| Caption | ≤ 500 | Keep it under 500 characters. |
| Submitting an incomplete package | Server | Every deliverable needs its files before you can send this. |
| Changing a submitted package | Server | {Brand} are reviewing this. You can change it if they ask for changes. |
| Submitting twice | Server | This is already with {Brand}. |
| Approving twice | Server | This is already approved. |
| Change request with no reason | Required | Say what should change. |
| Change request beyond the rounds | Server | You've used both rounds. Approve this, or report it to INFLX. |
| A link that isn't a link | Server | Paste the full link to the post. |
| Confirming posted with a row unproved | Server | Add a link for every deliverable first. |
| Confirming live before she posts | Server | {Name} hasn't posted yet. |
| Confirming live twice | Server | This is already confirmed. |
| Reporting brand silence too early | Server | You can tell INFLX from {date}. |
| Reporting twice | Server | You've already reported this. |
| Any money action out of order | Server | (report what you propose) |

---

## 8. Look and feel

Item 2's theme as items 3–11 use it:

- White, `#F6F6F3` surfaces, `#E5E4DE` borders, ink `#1A1A17` / `#5B5A53` / `#77766E`; yellow `#FFC700` for the single main button; red only where something ends.
- The round pill is item 6's, reused unchanged.
- File tiles are square-ish with a rounded corner; videos carry a duration badge.
- Counts per row: grey when empty, green when met.
- The change-request reason is quoted in the amber family; per-file notes in the same amber.
- The fee card: a filled dot for paid, an amber ring for next, an empty ring for later — the same vocabulary as the step line.
- Money "₹3,240"; dates "23 Oct"; Plus Jakarta Sans.

---

## 9. Phase 1 checklist

### 9.1 Database
- Every column of any existing content-submission table, with writer and reader.
- Everything in §4 (D1–D12) mapped to a column or named as missing.
- The escrow and ledger tables as item 9 left them.
- Indexes for both sides' lists and for J1's lane.
- Production counts from §3's last row.

### 9.2 Backend
- Every endpoint in §5, with what exists today, its shape, its callers and its access checks.
- The "shoot is done" test, and every path into the content step.
- The tranche-release path, in full, with what item 12 must call.
- The jobs runner and where J1 fits (name a free minute).
- The notification service and the keys that exist.

### 9.3 Phone apps
- **Creator:** where this attaches after the shoot screens; the upload, the caption, the link fields, the screenshot.
- **Brand:** the review, the file viewer, the confirm sheets.
- Components reusable from items 2–11, and what is new.
- **Check before assuming:** can the app pick a photo and a video from the gallery, show a video, and upload 200 MB reliably? Say plainly what is OTA-safe and what needs a new build, with a fallback for each.

### 9.4 Websites and admin
- The two new numbers on the existing settings page; anything on the brand website that reviews content today — recommend retiring it server-side, as items 10 and 11 did.

### 9.5 Tests
- Baseline pass and fail counts into `baseline_item12.json`; existing tests touching content, escrow, tranches and the jobs.

---

## 10. Phase 1 output

Write **`Docs/ITEM12_CONTENT_GAP_REPORT.md`**:

1. **Summary:** area · status · one-line gap.
2. **Requirement table:** ID · requirement · status · evidence (`file:line`) · proposed change · risk.
3. **The money, first and in full:** the tranche machinery, what a tranche-2 and tranche-3 release writes, every existing release path, and how item 12 calls it without duplicating it.
4. **What already exists** for content submission and review: keep, extend or retire, part by part.
5. **The gate:** every path into the content step and what each checks today.
6. **Storage and uploads:** where files live, how a 200 MB video gets there from a phone, how they are served privately, and every limit in the stack.
7. **Link readiness (§3),** row by row — including whether the deliverable type carries a platform.
8. **Proposed migrations** (additive), with dry-run checks.
9. **Proposed endpoints** with shapes, error codes and affected callers.
10. **The job lane** J1 and the J2 extensions, and how each is proved idempotent.
11. **Frontend plan** per screen, components reused and new, and the picker / player / upload answer.
12. **What items 14 and 15 will reuse.**
13. **Test baseline** and the tests you will add.
14. **Questions for the founder,** each with a recommendation, including every assumption in §11.

Then **stop and wait for approval.**

---

## 11. Assumptions to confirm in your questions

1. **The completed shoot is the only door**, for both modes, and Pay for Content is the only Aim.
2. **What she owes is fixed at signing** — rows of platform and count, never editable here.
3. **Photos ≤ 10 MB, videos ≤ 200 MB, ≤ 10 files a row, caption ≤ 500**, validated on the server.
4. **One complete package**; an incomplete one is refused, not accepted as partial work.
5. **Submitting locks it**; a change request reopens it; every round is kept.
6. **One verdict per package**, with a required reason on a change request.
7. **The rounds number is stamped at her first submission**, the last round is warned, and beyond it there is no third round — only approve or report.
8. **Approval locks the content**; what she posts is what was approved.
9. **A link per deliverable, a screenshot for a Story**, and her confirmation that she posted.
10. **No auto-confirm of "live."** Silence gives her the right to tell INFLX after the stamped days.
11. **Confirming live releases the second 25%** and stamps the waiting period; **the final 50% follows by job** and completes the collaboration.
12. **Nothing is re-checked** in the waiting period.
13. **Item 12 moves those two payments and nothing else**, with nothing deducted.
14. **Files are private** to the two parties, and to Admin only on a dispute.
15. **Disputes are recorded here and handled in item 18.**

Report also, as questions: what happens if a creator's linked post is later deleted before the final 50% (recommend: nothing, per §12.2); whether Admin needs a read-only view of content for disputes now or in item 18; and whether any existing Pay for Content collaboration in production would jump straight into a state this item does not expect.

---

## 12. After approval (not in Phase 1)

- **Phase 2a:** the gate, the Aim check, the retirements, and the privacy check on every file-serving path — before any feature work.
- **Phase 2b:** storage and uploads, proved on their own with a 200 MB video.
- **Phase 2c:** the package, the review and its rounds, posting and proof, confirming live, the two releases, J1, the J2 extensions, the Admin numbers, notifications, Needs You.
- **Phase 3:** the Creator screens C1, C3–C5, C8, C10, C12, C15; the Brand screens C2, C6, C7, C9, C11, C13, C14, C16; Admin C17.
- **Phase 4:** tests.

### 12.1 Final functionality: all must pass

1. The content step opens only when the shoot is done, for both modes, and only for Pay for Content.
2. The deliverable rows come from the agreement and cannot be added to, removed or edited by either side or the API.
3. Every file limit is enforced on the server: type, size, count per row, caption length.
4. An incomplete package cannot be submitted, from the app or the API.
5. Submitting locks the package; adding, replacing or removing during review is refused.
6. Approving with no rounds used, after one round, and after the last round all work and record who and when.
7. A change request without a reason is refused; with one, it reopens the package and keeps the round.
8. The rounds limit is the number stamped at her first submission; changing the Admin number afterwards does not move it.
9. On the last allowed round the brand is warned before deciding.
10. A change request beyond the limit is refused by the API; only approve or report remain.
11. Approval locks the content; no file can change afterwards.
12. A link is required for every deliverable, a screenshot for every Story row, before she can confirm she posted.
13. The brand cannot confirm live before she confirms she posted.
14. Confirming live releases exactly the second 25%, from the locked amount, with nothing deducted, and stamps the waiting period.
15. There is no path that auto-confirms "live".
16. After the stamped silence period she may report; before it, the report is refused with the date.
17. Reporting `posted_wrong` records a dispute and moves no money.
18. The job releases the final 50% at the stamped due, marks the collaboration Completed, and tells both sides.
19. Changing the waiting-period number afterwards does not move a stamped due date.
20. Two taps, or two devices, produce one submission, one verdict, one confirmation, one release.
21. **No money moves anywhere in item 12 except those two releases** — proved by balances, escrow rows and both ledgers before and after a complete run.
22. Past the posting date the collaboration is flagged Delayed with the correct content stage, both told once, and everything stays usable.
23. Needs You shows the right move to the right side at each of the five points.
24. Each unanswered move is reminded once at 48 hours and not again within 48 hours.
25. A file is served only to the owning brand, that creator, and Admin on a dispute; every other request is 404, and signed URLs expire.
26. Another brand's or another creator's content, files, links or actions return 404.
27. Loading, empty and couldn't-load states appear on both sides' content screens.
28. Every confirm sheet honours `busy`.
29. Backend tests show no new failures against `baseline_item12.json`.

### 12.2 Final deliverable

A short summary of what changed, the money path stated first with proof that only two payments moved, the storage and upload answer, the test results, the result of every check 1–29, what items 14 and 15 can reuse, and anything left open.

Nothing is submitted, approved, rejected, confirmed, reported or completed in production, and no money moves, without asking the founder first.
