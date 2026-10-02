# C06-status-icons-unclear — Action / status indicators unrecognisable

## TODAY
These are not icons in the code. They are small text pills ("chips"): 11px bold text, about 24px tall, pale tinted background, no border, no arrow, no enlarged touch area.

BRAND: set screen (BrandSetDetailScreen), top to bottom
- Header with set name and a "⋯" menu.
- Campaign name with a green "Live" pill. This is status only and cannot be tapped.
- Blue strip "Invitations close in N days".
- Summary card, then the creators grouped under headings.

Each creator row is: avatar, name (15px), one grey line (12px), sometimes a pill, then "⋯" (36x36).

| State of the row | What is drawn today | Tappable? Can a user tell? |
|---|---|---|
| Invitation not answered ("Waiting to answer") | Grey line "10% · sent 12 Sep". No pill. | Row tap opens the "⋯" menu. Reads as plain text. |
| Creator countered, or asked to move ("Your move") | Amber pill "Your move" | Yes, opens the conversation. Looks like a label. |
| Brand countered ("Negotiating") | Blue pill "Waiting" | Yes, opens the conversation. Looks like a label. |
| Accepted, agreement not sent | Green pill "Send agreement", about 100x24px | The pill is the only door to sending. Tapping the row opens "⋯" (View terms / Open profile / Remove), which has no agreement entry. Looks identical to the "Live" tag. |
| Creator signed, brand must sign | Green pill "Sign", about 40x24px | Same problem, and smaller. It sits right beside "⋯", so it is easy to mis-tap. |
| Agreement sent, waiting for the creator | Sits under the heading "Waiting to answer". Grey line "Agreement sent 14 Sep". No pill. | Row tap opens "⋯" only. The agreement and "Withdraw agreement" cannot be reached from this row. |
| Signed, nothing owed | Grey line "Signed by both ..." or the shoot line. No pill. | Row opens the shoot, content or going-live screen. |
| Signed, brand owes a step (send plan, confirm shoot, review content, confirm live) | Amber pill "Your move" | Yes, opens the right screen. The pill does not say what the move is. |
| Signed, Remote shoot | "Signed by both ..." for the whole shoot. The Remote progress line is never drawn. No pill. | Row tap opens "⋯"; "Open the Remote shoot" is inside it. |
| Going live finished | Purple pill "Completed · selling" | Not tappable. |
| Asked for another date | Blue pill "Another set" | Pill opens the conversation; row opens her profile. |
| Declined / expired / withdrawn | Grey line only | "⋯" only. |

BRAND: agreement screen (BrandAgreementScreen)
- Before sending: full-width black button "Send for signature". This one is clear.
- After sending: no status sentence at all. The only control is a red "Withdraw" button. The "sent" confirmation message is never seen because the screen closes in the same instant.
- After she signs: amber sentence box and a black "Sign and lock ₹X" button. Clear.

BRAND: other screens
- Conversation (BrandThreadScreen): tinted sentence box plus full-width labelled buttons. Clear.
- Campaign screen and pool: only state tags (Draft / Live / Expired, "PITCH", "Closing in N days"). No per-creator action. Fine.

CREATOR: Collabs cards (CollabsScreen, InvitationCard5)
- One pill at top right: none for a new invitation; "Your move" (amber) for a counter or an agreement to sign; "Waiting" (blue); "Accepted" (green); "Active" (purple).
- The pill stays "Active" on a signed card even when it is her turn (upload content, mark the visit, send her address).
- The Remote progress line the server sends is never drawn on the card.
- No button, arrow or "Open" cue on any card. The whole card is tappable but nothing says so.

## ROOT CAUSE
1. One visual for two jobs. `Chip5` (bits5.js:24-31, style 261-262: fontSize 11, padding 5/8, no border, no icon) draws both pure status and the brand's only action buttons. `StateChip4` (bits4.js:106-107) has the identical style, so the "Live" tag and "Send agreement" look the same.

2. The action pill is the only door, and it is tiny. bits5.js:161 wraps the chip in a bare `TouchableOpacity` with no `hitSlop` or `minHeight`, giving roughly 24dp of height against a 48dp guideline. It sits directly beside the 36x36 "⋯" (bits5.js:162).

3. Tapping the row does not do the row's action. BrandSetDetailScreen.js:214-216 routes a tap on a send-agreement, sign or agreement-sent row to `setCreatorMenu(row)`. `creatorActions` (lines 130-143) has no agreement entry.

4. The phone ignores what the server already sends. invitationRows.service.js:245-247 returns `actions.withdrawAgreement`, `viewAgreement` and `downloadAgreement`; no file under Packages/Mobile/src reads them. Once sent, the agreement is unreachable from the set screen until she signs.

5. The waiting row has no chip. bits5.js:119-125 (`case 'waiting'`) sets only `meta`. The server puts a sent-but-unsigned agreement into the `waiting` group (invitationRows.service.js:62), and the phone titles that group "Waiting to answer" (copy5.js:209, used at BrandSetDetailScreen.js:206).

6. Colour drift from the latest board. bits5.js:102 and 105 give "Sign" and "Send agreement" tone `active` (green). P1 draws both amber, as "your move".

7. Signed rows carry no chip unless the brand owes something (bits5.js:130-147). Nothing in bits5.js references `row.remote` or `card.remote`, so the Remote line is never shown on either side.

8. Creator card: the chip is `C5.creator.chips[card.group]` (bits5.js:172, 213), and for `signed` it is always "Active" (copy5.js:238) with tone `completed` (purple, copy5.js:272). It ignores `content.yourMove` and `goingLive.yourMove`, which the server sends.

9. The locked boards themselves draw these actions as the same 11px pills (.chip CSS at line 99 of the item5/6/7 mockups). The code is faithful to the boards in form, so a fix needs a redraw and re-lock, not only a code change.

## MOCKUP
{
 "file": "C:\\WORK\\inflx-platform\\features\\item7-agreement\\04-preview\\mockups\\item7-agreement-locked.html",
 "screen_ref": "P1 \"Where the agreement starts\" (latest board for the brand set screen). Also I9 (item5), N20 (item6), and P4 / P16 / V4 for the creator cards.",
 "what_mockup_shows": "Small 11px pills, not labelled buttons.\n- \"Your move · 2\": Sneha \"Accepted 13 Sep · 12%\" with an amber pill \"Send agreement\"; Tanvi \"Signed 14 Sep · waiting for you\" with an amber pill \"Sign\".\n- \"Waiting for the creator · 1\": Priya \"Agreement sent 14 Sep\" with a blue pill \"Waiting\".\n- \"Signed · 1\": Divya \"Signed by both 13 Sep\" with a green pill \"Active\".\n- I9 drew \"Send agreement\" green; N20 draws \"Your move\" amber and \"Waiting\" blue.\n- Creator V4: the Active card carries an amber \"Your move\" pill when it is her turn.\n- Creator P16: \"Next ...\" line plus an underlined \"Agreement\" text button.",
 "live_matches_mockup": "partly",
 "difference": "The form matches: the app draws the same small pills the boards draw, so the hard-to-recognise complaint comes from the locked design itself.\n\nFour details do not match P1:\n- \"Send agreement\" and \"Sign\" are green in the app; P1 draws them amber.\n- The agreement-sent row has no \"Waiting\" pill and sits under \"Waiting to answer\"; P1 has \"Waiting for the creator\" with a blue pill.\n- Signed rows have no \"Active\" pill.\n- The creator's Active card never switches to \"Your move\" (V4), and has no \"Agreement\" text button (P16).\n\nThe board does not say what tapping the row does. The app sends that tap to a menu with no agreement option."
}

## CORRECTIONS
- Button colour is wrong in the finding. "Send for signature" and "Sign and lock" are PrimaryButton, which is yellow #FFC700 with dark ink text, not black: Packages/Mobile/src/components/settings/primitives.js:245-247 and theme/tokens.js:512. The locked boards agree (.b-pri uses --primary #FFC700, item7-agreement-locked.html CSS). tokens.js:507-508 says yellow is only ever the one main button on a screen. Black fill with white text already means "selected" (bits5.js:288 typeChipOn, shoot/bits10.js:298 chipOn, bits10.js:266 live time card).
- Root cause 3 is overstated. BrandSetDetailScreen.js:214-216 sends the row tap to the ⋯ menu only when row.actions.thread is false. thread is true for any row that ever had a negotiation or a move request (invitationRows.service.js:240), so a send-agreement, sign, agreement-sent or signed-Remote row that was reached through a counter opens the old conversation (BrandThread). It never opens the agreement in either case.
- "Asked for another date: row opens her profile" is wrong in the usual case. thread is checked before the deferred branch (BrandSetDetailScreen.js:215-216), and a deferred row normally carries move_requested_at, so the row opens the conversation.
- "Completed · selling ... Not tappable" is only true when the row never had a thread. onChip falls through to openThread when row.actions.thread is true (BrandSetDetailScreen.js:221-228), so tapping that tag can open the old negotiation.
- "The sent message is never seen" is a little strong. show() then goBack() (BrandAgreementScreen.js:74-75) leaves the toast on a screen that is animating away; it may flash briefly. The house pattern (hooks/useRouteToast.js, already wired at BrandSetDetailScreen.js:45) is not used. Effect for the user is the same: no confirmation.
- The finding treats P1 as the latest board for the set rows. A later locked board exists: item14 v2, board S2 "Brand · the set, one row per creator" (locked 30 Sep 2026). It draws named tags "Review it", "Confirm live" (amber), "Her move" and "Shoot" (blue), "Completed · selling". Live code shows a generic "Your move" (bits5.js:134, 138, 143) and no tag when it is her move. item14 06-diff/notes.md:22 records S2 as matching, which it does not.
- Open question 2 (generic "Your move" or name the action) is therefore already answered by locked S2: the action is named.
- The creator's "Active" tag is purple in code (GROUP_TONE.signed = 'completed', copy5.js:272). Locked P16, V4 and R2 draw it green (chip s-active). The finding mentioned purple but did not flag it as drift.
- The item 7 diff notes recorded only one P1 difference, the group title (features/item7-agreement/06-diff/notes.md:23), and recorded P16 as "None". The green-instead-of-amber tags, the missing "Waiting" and "Active" tags, the cutoff strip wording (code: "Invitations close in N days", copy4.js:116; P1: "Both signatures needed by 17 Oct · 4 days") and the missing P16 "Agreement" text button were never recorded as differences.
- Option B's risk line "phones still on the old bundle ... it is safe" is only partly true. An old bundle would title a new server group correctly, but SetCreatorRow5's switch (bits5.js:94-153) has no case for a new group key, so the row would fall back to the terms line and lose "Agreement sent ..." until the OTA lands.
- The pill sizes (about 24dp tall, about 40dp wide for "Sign") are calculated from bits5.js:261-262, not measured. The finding says so; I confirm the arithmetic only.
- All other cited file and line references were opened and are accurate: bits5.js 24-31, 97-111, 119-125, 130-147, 155-163, 168-225, 261-262; BrandSetDetailScreen.js 130-143, 173, 206, 214-229; bits4.js 13-21, 106-107; copy5.js 208-218, 236-238, 271-277; invitationRows.service.js 36-64, 235-248; BrandAgreementScreen.js 68-76, 136-140, 278-292; tokens.js 515-526; mockups item7 99-103 and 398, item5 99 and 318, item6 99 and 373, item10 448. CollabRow and StageTabs are imported nowhere, as stated.

## MISSED SITES
- C:\WORK\inflx-platform\Packages\Mobile\src\components\invitations\bits5.js :: Line 159: the status sentence on every set row is numberOfLines={1} at 12px. Long server sentences such as "Plan sent for Sun 4 Oct, 11:00 am — waiting for Kartikeya to answer" are cut off. This is part of why statuses are hard to read, and a wider action button makes it worse unless the row becomes two lines.
- C:\WORK\inflx-platform\Packages\Mobile\src\components\invitations\bits5.js :: Lines 82-83 (ReviewRow5): tones 'ok' and 'below' are passed straight to Chip5, but tokens.js state has no such keys, so "OK" and "Below min" both fall back to grey. Locked I8 draws OK green and Below min amber.
- C:\WORK\inflx-platform\Packages\Mobile\src\components\invitations\bits5.js :: Line 148: "Another set" uses tone 'waiting' (blue); locked I9 draws it amber (s-move). Lines 134/138/143: generic "Your move" where locked S2 (item 14) draws "Review it" / "Confirm live", and no tag where S2 draws "Her move" / "Shoot".
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\brand\BrandAgreementScreen.js :: Lines 102-103: withdraw() has the same show-then-goBack pattern as send(), so "Agreement withdrawn." is lost too. Line 280: the locked P2 button carries a send icon; the code passes no icon.
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\brand\BrandSetDetailScreen.js :: Lines 130-143: for a sent agreement the menu offers only "Remove from set" ("Withdraw invitation" needs status invited). "Withdraw agreement" (locked P14, drawn over the creator's ⋯ header "Priya Sharma · SET A") cannot be reached anywhere on the phone; the only navigation to BrandAgreement is the chip at lines 225-226.
- C:\WORK\inflx-platform\Packages\Mobile\src\components\pitch\bits8.js :: Lines 64-88 (PitchCard8): the brand's Pitches list and the creator's My pitches use the same Chip5 for "Your move" / "Waiting" with no button cue. Same pattern, not listed.
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\influencer\InvitationScreen.js :: Line 85: the creator's invitation screen shows the same state pill at the top. Status only, but it is another Chip5 caller that any restyle of Chip5 will change.
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\brand\BrandSetPickCreatorsScreen.js :: Lines 181 and 214, plus BrandGroupInviteCheckScreen.js:83: "Invited" / "Can't invite" / "Closing in N days" use Chip5. Status only; they change if Chip5 itself is restyled.
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\influencer\CollabsScreen.js :: Lines 87-96: a signed card routes to content, going live, shoot or Remote and never to the agreement. Locked P16 draws an underlined "Agreement" link on the Active card; it was never built.
- C:\WORK\inflx-platform\Packages\Mobile\src\components\campaigns\bits4.js :: Lines 64-103 (CampaignCard4, SetCard4): nothing on the campaign list or the set cards says a set has something waiting for the brand. The Home tab is a placeholder (BrandNavigator.js:225) and utils/brandNeedsYou.js is used only by its own test. The brand must open each set to find the pill. Known as deferred (Needs You, §24), but it adds to the complaint.
- C:\WORK\inflx-platform\features\item14-sale-going-live\06-diff\notes.md :: Line 22 records S2 as matching with a "Your move" chip, while the locked S2 draws named chips. Unrecorded drift from a locked board.

## FIX RISKS
- A black filled button is not in this design system. Main buttons are yellow, one per screen, and black fill means "selected". Putting yellow on every row breaks the one-main-button rule; putting black on rows can read as a selected chip. The row button needs its own style, chosen on the board. The closest existing look is the small ink-outline button (locked .btn.b-sec.sm2; bits10.js:275 addrBtn).
- Chip5 has seven callers (InvitationScreen, PitchCard8, PoolRow6, BrandSetPickCreatorsScreen, BrandGroupInviteCheckScreen, ReviewRow5, InvitationCard5). Adding an outline or icon to Chip5 changes locked boards of items 5, 6 and 8. StateChip4 (bits4.js) and DelayedChip10 (bits10.js) are separate copies and would not change, so tags would become inconsistent. Build a new row-action component and leave Chip5 alone, or restyle all copies deliberately.
- Tests that break: item6Brand.test.js:241 uses getByText('Waiting'), which fails if a second "Waiting" tag appears on unanswered rows. item7Brand.test.js:271-272 uses exact getByText('Send agreement') and getByText('Sign'), which fail if a chevron is put inside the same text. item7Brand.test.js:278-280 and shoot10.test.js:135 press testID chip-<id>. shoot10.test.js:134 and 140 expect "Your move" present / absent. item5Brand.test.js:105 uses a single-match getByText('Your move').
- More tests: item6Brand.test.js:245 asserts that a row with a conversation opens BrandThread, so the new row-tap order must put the agreement first only on send / sign / agreement-sent rows. item7Creator.test.js:224 and 239 and item5/6Creator tests read testIDs card-chip-<group>; keep them keyed on the group even when the label becomes "Your move".
- No-fake-green applies. Each changed assertion must be classified as assertion drift against the newly locked board, not quietly loosened.
- Option B (new server group) breaks backend/tests/item5-invitations.test.js:452, which asserts the exact group order, and touches :153 and item7-agreement.test.js:97-102. Old phone bundles would lose the "Agreement sent" line. The heading can be split on the phone instead (rows in 'waiting' with agreement.sentAt), with no server deploy.
- Small phones: at 360dp wide, a labelled button of about 130dp plus the 36dp ⋯ and the avatar leaves about 105dp for the name and the status sentence, which is already one line. The row must be redrawn (button under the text, or two-line status) or names and statuses will be cut.
- Governance: this is a mobile runtime change. It needs its own contract, a mockup lock, 06-diff notes and a Maestro-green flag before release (gov-check rules 3, 4 and 5). It supersedes rows on four locked boards (I9, N20, P1, S2), which should be noted in those contracts.
- Recolouring ("Send agreement" and "Sign" to amber, creator "Active" to green) triggers the contrast-audit rule; jest will not catch a low-contrast result.
- Creator "Your move" on Active cards: the server sends yourMove only for content and going live (invitationRows.service.js:503, 542). For store visit and Remote the phone would have to guess from stage names, as the brand row already does (bits5.js:143). That guess can drift from the shoot screens; an explicit server flag is the safer later step.
- Toast hand-off: use navigation.navigate('BrandSetDetail', { campaignId, setId, toast }). This relies on React Navigation 6 going back to the existing screen (package.json: native-stack ^6.9.26). It would push a duplicate under v7.
- No native rebuild is needed: react-native-vector-icons is already used (bits10.js:12, primitives.js). The change ships over the air to both the brand and influencer bundles, so both need publishing. brand-web does not read the set summary, so the website is unaffected.

## FIX FINAL
Do Option A, phone only, with these changes. No server deploy.

1. New row-action button. Build a separate component for the brand's moves on a set row. Do not restyle Chip5. It carries a label and a chevron, is at least 44dp to touch, and keeps testID chip-<id> and the exact label text (chevron as a separate icon). Its look (ink outline or black fill) is chosen on the board, because yellow is reserved for the one main button and black currently means "selected".

2. Name the action, as locked S2 already does. "Send agreement", "Sign", "Review it", "Confirm live", plus names for reply-to-counter, plan the visit and confirm the visit.

3. Status tags stay small and visibly not buttons. Add a clock icon for waiting. Add the missing ones: "Waiting" on agreement-sent rows (P1), "Active" on signed rows (P1), "Her move" / "Shoot" (S2). Fix the drifted colours: amber for brand moves, green "Active" on the creator card, amber "Another set", green/amber "OK" / "Below min".

4. Row layout. Let the status sentence wrap to two lines, or put the button under the text, so nothing is cut on small phones.

5. Row tap does the row's job. Send / sign / agreement-sent rows open the agreement. Remote rows open the Remote shoot. Counter rows keep opening the conversation. Read row.remote.line so Remote rows say where the shoot is.

6. ⋯ menu. Add "View agreement" and "Withdraw agreement" from the flags the server already sends (actions.viewAgreement, actions.withdrawAgreement).

7. Heading. Split the "waiting" group on the phone into "Waiting for the creator" (agreement sent) and "Waiting to answer" (invitation unanswered).

8. Agreement screen. Add a blue waiting box using the existing StateBox7 ("Sent 14 Sep. Waiting for Sneha to sign by 17 Oct."). Pass "Agreement sent." and "Agreement withdrawn." back to the set screen through the existing route-toast hook.

9. Creator cards. Show "Your move" when content.yourMove or goingLive.yourMove is true, or the shoot / Remote stage is hers. Draw the Remote line (R2). Add the P16 "Agreement" link and an open cue.

10. Process. Open a new contract, draw and lock the board first, update the listed tests as recorded assertion drift, run the contrast check, then OTA both bundles.

Files: components/invitations/bits5.js, copy5.js, negotiation/copy6.js, agreement/copy7.js, screens/brand/BrandSetDetailScreen.js, screens/brand/BrandAgreementScreen.js, screens/influencer/CollabsScreen.js, and the item5/6/7 brand tests, shoot10 test and item7 creator test.

Decision for you: the button style (ink outline or black fill) and the waiting colour (blue as on the boards, or grey).

## DRAW FINAL
Three boards. They replace only the creator rows and cards on locked I9, N20, P1 and S2 (brand) and P4, P16, V4 and R2 (creator).

BOARD 1: Brand, set screen
Keep the header, the green "Live" tag, the cutoff strip, the counts line and "Add creators". Draw the row as two lines so no sentence is cut. One row per state:
1. Your move, agreement to send: "Sneha N." / "Accepted 13 Sep · 12%" with the action button "Send agreement ›".
2. Your move, brand to sign: "Tanvi S." / "Signed 14 Sep · waiting for you" with "Sign ›".
3. Your move, she countered or asked to move: "Countered 13% · 13 Sep" with a button. Wording to decide: "Reply ›" or "Your move ›".
4. Negotiating, brand countered: "You countered ₹9,000 · 14 Sep" with a clock and the tag "Waiting". Not a button.
5. Heading "Waiting for the creator": "Agreement sent 14 Sep" with a clock and "Waiting to sign". Note: tapping the row opens the agreement.
6. Heading "Waiting to answer": "10% · sent 12 Sep" with a clock tag and ⋯.
7. Signed, nothing owed: "Signed by both 13 Sep" with a green "Active" tag.
8. Signed, brand owes a step: buttons named as on S2 and the shoot boards: "Plan the visit ›", "Confirm visit ›", "Review it ›", "Confirm live ›".
9. Signed, her move: "Her move" tag (S2). Signed, Remote: the Remote line ("Waiting for her delivery address") with a tag.
10. "Completed · selling", Declined, Expired, Withdrawn: tag or grey text, unchanged.
Also draw:
- The "Live" tag next to an action button, to show the difference.
- The ⋯ menu for an agreement-sent row with "View agreement" and "Withdraw agreement".
- Two button styles side by side for you to pick: ink outline and black fill. Yellow stays reserved for the one main button.

BOARD 2: Brand, agreement screen after sending
(a) The P2 screen with a blue waiting box at the top with a clock: "Sent 14 Sep. Waiting for Sneha to sign by 17 Oct." Red "Withdraw" stays at the bottom.
(b) The set screen straight after sending, with the message "Agreement sent." and Sneha's row now under "Waiting for the creator".

BOARD 3: Creator, Collabs cards
(a) New invitation: "Reply by 17 Oct · 4 days left" and an open cue.
(b) Agreement to sign: amber "Your move", "Agreement ready to sign · by 17 Oct", button "Review & sign ›".
(c) Signed, waiting: clock and "Waiting", "Signed. Waiting for Urban Threads to sign by 17 Oct."
(d) Active, her move, store visit: amber "Your move", "Store visit planned for 18 Oct, 11:00 am", open cue.
(e) Active, her move, Remote: amber "Your move", "Send your delivery address" (R2).
(f) Active, waiting on the brand: green "Active", the "Next ..." line, and the underlined "Agreement" link (P16).

Rules on all three boards: anything tappable that moves the work forward is a labelled button of at least 44dp. Tags are small, pale, carry an icon and are never button-shaped. One action per row.

## QUESTIONS
- The locked boards (P1, N20, I9) draw "Send agreement", "Sign" and "Your move" as small pills. Do you agree the new board replaces those rows with black labelled buttons and the three boards are re-locked?
- For "Your move" rows, keep the generic label "Your move", or name the action ("Reply", "Confirm shoot", "Review content", "Confirm it's live")? Naming it is clearer but adds new wording to the locked copy.
- Waiting colour: the boards use blue for "Waiting"; the mono rule says orange for pending/waiting. Which should the waiting tag use? I would suggest blue or grey with a clock, and orange kept for "your move".
- Should "Agreement sent, waiting for her signature" be its own group "Waiting for the creator" as P1 shows (needs a small server change and deploy), or stay under "Waiting to answer" with a clear "Waiting to sign" tag (phone only)?
- Creator cards: a black button on the card when it is her move ("Review & sign"), or only the "Your move" tag plus an "Open ›" cue?
- May the brand reopen and withdraw a sent agreement from the set row and its "⋯" menu? The server already allows it and P14 draws the withdraw sheet, but today the phone gives no way to reach it.

## TESTS
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\brand\__tests__\item5Brand.test.js
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\brand\__tests__\item6Brand.test.js
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\brand\__tests__\item7Brand.test.js
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\brand\__tests__\item4Brand.test.js
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\influencer\__tests__\item5Creator.test.js
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\influencer\__tests__\item6Creator.test.js
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\influencer\__tests__\item7Creator.test.js
- C:\WORK\inflx-platform\Packages\Mobile\src\components\shoot\__tests__\shoot10.test.js
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\__tests__\contentScreens.test.js
