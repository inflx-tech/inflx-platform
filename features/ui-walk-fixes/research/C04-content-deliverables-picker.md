# C04-content-deliverables-picker — Pay for Content: deliverables chooser is messy

## TODAY
Brand app, "Terms · {creator name}" screen for a Pay for Content set (the per-creator terms step after picking creators), top to bottom:
1. Header "Terms · Priya Sharma" with back arrow; small line "Creator 1 of 3".
2. Grey locked card "Set terms, same for everyone" (Aim, Posts on, Mode).
3. "Fee *" with a rupee number box and the hint about 25/25/50 payment.
4. "What she delivers *". It starts with one line already filled (Instagram reel, 1). Each deliverable line is drawn as:
   - on the left, ALL FIVE type buttons as small pills that wrap onto several lines (Instagram reel / Instagram post / Instagram story / YouTube video / YouTube short); the chosen one is black, the other four are white outlines;
   - to the right of that pile, an 84-wide typing box for the number (opens the number keypad; placeholder "1");
   - at the far right a small grey "✕" to remove the line.
   On a normal-width phone the pills fit one or two per line, so ONE deliverable takes roughly 3 to 5 lines of pills (about 105-175 points tall, estimated from the style values) with the number box floating in the middle beside them.
5. Under the lines, plain bold text "+ Add another" (not a button). Tapping it does not ask what to add: it silently adds the next unused type with count 1, and the brand then has to tap a different pill in the new pile to change it.
6. Grey hint "Reels, posts, stories, YouTube videos and shorts." and, after pressing Next with a problem, a red error line ("Add at least one thing she delivers." / "Choose between 1 and 20." / "You've already added that. Change the count instead.").
7. Then "Anything else she should know" note box, the "Brand can reuse the content" switch with duration and place chips, "Use these terms for everyone" switch, and the black "Next creator" / "Review and send" button pinned at the bottom.
Extra faults seen in the code: tapping a pill for a type that is already on another line is allowed and only complains when Next is pressed; once all five types are added, "+ Add another" still shows and adds a second "Instagram reel" line that can never be valid; the number is typed by keyboard for a value that is only ever 1 to 20.

## ROOT CAUSE
One shared component, DeliverablesEditor5 (Packages/Mobile/src/components/invitations/bits5.js:228-257), draws the type selector for EACH row by looping over the whole DELIVERABLE_TYPES list and rendering every type as a chip inside a wrapping container (bits5.js:238-244, styles typeWrap/typeChip at :286-290), instead of one closed field showing only the chosen type. The count is a free-typing NumberField with the number keypad (bits5.js:246-248). "Add another" is a bare text link (bits5.js:252, style :293) whose handler auto-picks the next unused type, or falls back to the first type when all five are used, creating a guaranteed duplicate (bits5.js:232). Changing a row's type has no guard against a type already used on another row (bits5.js:240), and the row key includes the type so the row is rebuilt on every type change (bits5.js:236). The item 5 before/after notes (features/item5-invitations/06-diff/notes.md:21) list this component against board I4 without recording that the type control was built as chips rather than the single field the board shows.

Data and source of the types (nothing here needs to change for a cleaner picker):
- Saved shape is a plain list: deliverables: [{ type, count }]. No per-deliverable duration, format, channel or note exists anywhere. App builds it in draft5.js:139 (default one reel) and sends it in draft5.js:197; server validates in backend/src/services/invitationTerms.service.js:143-157 (at least one row, count whole number 1-20, no repeated type) and stores it on the creator's row as campaign_influencers.formats_json (invitationSend.service.js:292, :340).
- The five types are a fixed list, not a master table: Postgres enum deliverable_type (backend/migrations/001_initial_schema.sql:24-25: reel, post, story, youtube_video, youtube_short), mirrored in backend/src/services/invitationCopy.js:59-65 and hard-coded again in the app at Packages/Mobile/src/components/invitations/copy5.js:37-43. (facebook_post exists only for Pay for Sale going-live proofs in migration 199, not for content deliverables.)
- A Pay for Content set itself carries no deliverables: BrandSetEditScreen has no deliverables control; they are per creator (item 4 board: "No money or delivery terms: those are per creator in item 5").

## MOCKUP
{
 "file": "C:\\WORK\\inflx-platform\\features\\item5-invitations\\04-preview\\mockups\\item5-invitations-locked.html",
 "screen_ref": "I4 (Terms · Pay for Content). Same row is drawn on N3 in features/item6-negotiation/04-preview/mockups/item6-negotiation-locked.html and on the pitch form in features/item8-pitch/04-preview/mockups/item8-pitch-locked.html",
 "what_mockup_shows": "Under 'What she delivers *': one compact line per deliverable made of a single bordered field showing just the chosen type name ('Instagram reel'), a small 62px box showing the number ('1'), and a small bordered ✕ icon button. Two such lines are shown (Instagram reel 1, Instagram story 2). Below them an outlined secondary button with a plus icon, 'Add another', then the grey hint 'Reels, posts, stories, YouTube videos and shorts.' No pile of type buttons is shown anywhere. The board does not draw what happens when the type field is tapped (no dropdown list is drawn) and shows the number as a plain box, not a minus/plus stepper.",
 "live_matches_mockup": "partly",
 "difference": "Live has the right parts in the right order (type, count, ✕, Add another, hint) and the right wording, but: (1) the type is drawn as all five chips wrapping over several lines per row instead of one single field; (2) 'Add another' is plain text, not the outlined button with the + icon; (3) the ✕ has no bordered icon-button box; (4) the count box is 84 wide and keyboard-typed. The founder's new ask (a dropdown list, add with a + symbol, quantity) goes one step beyond the board, which never drew the open dropdown or a +/- quantity control, so that state must be drawn and locked."
}

## CORRECTIONS
- Mockup line is wrong: the I4 deliverable rows are on line 312 of features/item5-invitations/04-preview/mockups/item5-invitations-locked.html (caption 'I4 Terms · Pay for Content'). Line 313 is board I5 (Hybrid), which has no deliverables.
- Board N8 does not show deliverables. features/item6-negotiation/04-preview/mockups/item6-negotiation-locked.html:358 (caption 'N8 Brand · countering back') draws only the Pay for Sale counter (Commission 11.5%, 'She asked for 13% -> 11.5%'). The code does render the editor in that sheet for Pay for Content (Packages/Mobile/src/components/negotiation/sheets6.js:119-123), but that state has never been drawn or locked. 'Draw the same block on N8' is therefore a new board, not a redraw.
- The item 8 pitch board is T3 ('Creator · the pitch, Pay for Content', item8-pitch-locked.html:418). The finding left the board id unnamed.
- The hint 'Reels, posts, stories, YouTube videos and shorts.' is on board I4 only. Boards N3 (item6-negotiation-locked.html:352) and T3 (item8-pitch-locked.html:418) go straight from 'Add another' to the next element. Live prints the hint in all five homes (Packages/Mobile/src/components/invitations/bits5.js:253). 'Keep the wording exactly' needs a decision: hint everywhere, or only on the brand terms screen.
- Test impact is misdescribed. Packages/Mobile/src/screens/influencer/__tests__/item6Creator.test.js:139-140 only presses 'counter-deliverables-row-0-remove' and needs no change if that testID is kept. Packages/Mobile/src/screens/brand/__tests__/item5Brand.test.js:351-363 is the test that breaks, and it is not a testID rename: it drives the DUPLICATE and COUNT errors by tapping a type chip on row 1 and typing '21' (lines 354-363). Option A makes both states unreachable from the screen.
- No separate unit test of validateLocal exists. MSG5.DELIVERABLE_DUP and MSG5.DELIVERABLE_COUNT are asserted only at item5Brand.test.js:358 and :362. Deleting those lines would break the repo's no-fake-green rule; they must move to a direct draft5.validateLocal test.
- item6Brand.test.js, item8Brand.test.js and item8Creator.test.js never touch the editor's inner testIDs (the item6Brand N8 test is Pay for Sale, deliverables: [] at line 107). They only need the component not to crash; listing them as tests that assert current behaviour is loose.
- The claim that removing the typed count 'removes one place where the keyboard covers the field' is true only for that one box. BrandCreatorTermsScreen imports no KeyboardAvoidingView (BrandCreatorTermsScreen.js:11), so Fee and the note are still covered. This is not a fix for the founder's keyboard complaint.
- All other citations were re-opened and are accurate: bits5.js:228-257 and :285-293; copy5.js:37-43; draft5.js:139, 159-173, 196-198; BrandCreatorTermsScreen.js:123-131 and 136-137; CounterScreen.js:132-138; sheets6.js:84, 99, 119-123; PitchCounterScreen.js:153-158; PitchFormScreen.js:177; bits11.js:66-86; sheets14.js:33-51; invitationTerms.service.js:143-157; invitationCopy.js:59-65; invitationSend.service.js:292, 340; migrations/001_initial_schema.sql:24-25; 06-diff/notes.md:21. utils/collabCounter.js is imported by nothing but its own test. No wrapper, feature flag or newer component overrides the editor; all five homes are registered in BrandNavigator.js:139, 175 and InfluencerNavigator.js:165, 170, 174.

## MISSED SITES
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\influencer\PitchFormScreen.js :: Line 83: the pitch form's own check is only 'has rows and every count is non-empty'. It has no repeated-type or 1-to-20 check, the same gap the investigator flagged at sheets6.js:84. On a server refusal (lines 106-110) the message is filed under the server's field name 'formats_json', which nothing draws; only the toast speaks it.
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\brand\BrandThreadScreen.js :: Lines 39-43: when the brand's counter is refused, the message is shown as a toast on the screen underneath while the counter sheet (an RN Modal, components/settings/sheets.js:13-19) stays open on top. With sheets6.js:84 letting duplicates and counts above 20 through, the brand can hit a refusal that may be hidden. Not verified on a device.
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\shared\PitchCounterScreen.js :: Line 111: a server refusal about deliverables arrives with field 'formats_json' (backend/src/services/invitationTerms.service.js:145-154) and is written to errs.formats_json, which no element renders, so it is silent. CounterScreen.js:98 routes the same case to the form line correctly. Rare today because the local check catches it first, but worth aligning.
- C:\WORK\inflx-platform\Packages\Mobile\src\components\settings\primitives.js :: Lines 147-159: SecondaryButton already takes an icon prop (outlined button with a MaterialCommunityIcons glyph). This is the ready-made '+ Add another' button from the board; no new button style is needed.
- C:\WORK\inflx-platform\Packages\Mobile\src\components\shop\orderBits.js :: Line 99: a second minus/number/plus stepper (QtyStepper) exists beside QtyStepper11 (remote/bits11.js:66, which takes max). Reuse one rather than writing a third. bits11 imports only copy11, so importing it from bits5 creates no circular import.
- C:\WORK\inflx-platform\Packages\brand-web\app\dashboard\campaigns\[id]\page.js :: The website mentions the same type names. Not opened in depth; the founder's issue is about the phone apps. Check only if web/phone parity for this chooser matters.

## FIX RISKS
- An 'in-place dropdown' must be built as an expand-in-place list that pushes the rows below it down. A floating list positioned over the content is clipped by the ScrollView and does not receive taps outside its parent's bounds on Android. All five homes sit inside a ScrollView (BrandCreatorTermsScreen.js:85, CounterScreen.js:108, PitchCounterScreen.js:121, PitchFormScreen.js:135, sheets6.js:99). The board must draw the pushed-down state so build and board agree.
- The opened list can land out of sight: under the pinned 'Next creator' footer on the brand terms screen (absolute footer, BrandCreatorTermsScreen.js:146 and :206), or below the 440-high scroll area in the brand counter sheet (sheets6.js:99). Five options add about 200 points. It needs a scroll-into-view or the founder will tap and see nothing.
- The editor is seeded with rows it did not create: thread.current.deliverables from the server (CounterScreen.js:43, sheets6.js:62, PitchCounterScreen.js:50) and pool terms (draft5.js:127). The new rows must cope with a count that is a string or outside 1-20, a repeated type, or an unknown type code: coerce and clamp the stepper value, still allow removing a bad row, and keep validateLocal's duplicate/count checks as the safety net.
- No-fake-green: item5Brand.test.js:354-363 reaches the DUPLICATE and COUNT errors through the old chips and typed number. Rewrite the walk for the new controls and move those two assertions to a direct draft5.validateLocal test. Do not delete them. Keep the '-row-N-remove' and '-add' testIDs so item6Creator.test.js:139-140 stays green untouched.
- Governance: the locked boards of items 5, 6 and 8 belong to shipped contracts. This needs its own contract folder with its own mockups, mockup lock, 06-diff/notes.md, and maestro_green before release (gov-check Rules 3, 4, 5), rather than editing those locked files.
- Two OTA publishes are needed (brand and influencer), because PitchCounterScreen is registered in both navigators (BrandNavigator.js:175, InfluencerNavigator.js:174) and three of the five homes are creator-side. Per the OTA memory rule, publish one at a time.
- Row identity: the key today is type+index (bits5.js:236). With a per-row open/closed dropdown state, keep the key stable (index only) or the open state is lost when the type changes.
- Hiding '+ Add another' at five types and starting new rows at quantity 1 are behaviour changes on the creator's pitch form and counter screens too, not only the brand's. The 'they asked for X -> Y' change line (CounterScreen.js:137, PitchCounterScreen.js:159) must stay directly under the block.
- Backend contract is safe. The saved shape stays [{type, count}] and one validator serves invitation, counter and pitch (invitationSend.service.js:138, negotiation.service.js:244, pitch.service.js:310). No native rebuild: only RN core plus the MaterialCommunityIcons font already used by settings/primitives.js:21.

## FIX FINAL
Option A stands, with these adjustments.

Rebuild the one shared chooser, DeliverablesEditor5 in Packages/Mobile/src/components/invitations/bits5.js:228-257, keeping the same props (rows, onChange, error, testID) so the five call sites do not change.

1. **Each deliverable is one line:**
   - a bordered type field (42 high) with a down-arrow;
   - a minus / number / plus quantity, 1 to 20, no keyboard, reusing QtyStepper11 with max=20;
   - the bordered 32x32 remove button from the board.
2. **Type list:** tapping the type field or '+ Add another' opens the five types as a list that expands in place and pushes the content below down. It must not float and must not be a second pop-up. Types already used are greyed with 'Added'; the row's own type is ticked. The view scrolls so the list is visible.
3. **'+ Add another'** becomes the existing outlined SecondaryButton with a plus icon (settings/primitives.js:147). It is hidden when all five types are present.
4. **Robustness:** coerce and clamp counts from server or pool rows; use a stable row key.
5. **Saved shape** stays [{type, count}]; keep validateLocal and the server rules.
6. **Adjacent fixes in the same change:**
   - give sheets6.js:84 and PitchFormScreen.js:83 the same duplicate / 1-20 check as CounterScreen.js:72-82;
   - map the server's 'formats_json' error onto the deliverables line in PitchCounterScreen.js:111.
7. **Tests:** rewrite item5Brand.test.js:351-363 for the new controls; add a direct draft5.validateLocal test carrying the DUPLICATE and COUNT assertions; keep the '-row-N-remove' and '-add' testIDs.
8. **Governance and release:** a new contract with its own locked mockups; JS only; brand and influencer OTA, one at a time; no backend change, no migration, no APK rebuild.

Do not present this as the fix for the keyboard-covers-the-field complaint. That is a separate issue; this screen has no keyboard avoidance for Fee or the note.

## DRAW FINAL
Mono white/black, phone frame, as a new board set under a new contract. Do not edit the locked item 5, 6 or 8 files.

**Board 1: Brand, 'Terms · Priya Sharma', Pay for Content, 'Creator 1 of 3'.** Identical to locked I4 (item5-invitations-locked.html line 312) except the 'What she delivers *' block. Four states:

(a) Filled. Two lines, each one line high:
  [ Instagram reel          v ]  [ -  1  + ]  [x]
  [ Instagram story         v ]  [ -  2  + ]  [x]
Then the outlined '+ Add another' button, then the hint 'Reels, posts, stories, YouTube videos and shorts.' Minus is faded at 1, plus is faded at 20.

(b) List open after tapping '+ Add another'. The five types appear as a bordered list directly under the button, pushing the hint, the note and the rest of the screen down (not floating over them). 'Instagram reel' and 'Instagram story' are grey with 'Added' on the right. Instagram post, YouTube video and YouTube short are tappable.

(c) All five added. Five lines, no '+ Add another', hint stays.

(d) Empty with error. Only '+ Add another', the hint, and red 'Add at least one thing she delivers.'

Also show the list open from a row's own type field, with that row's type ticked.

**Board 2: Creator, 'Your counter' (as locked N3, item6-negotiation-locked.html line 352).** Label 'What you'll deliver *', same rows, with the change line 'They asked for  1 reel, 2 stories -> 1 reel, 1 story' directly under the block.

**Board 3: Brand counter-back pop-up for Pay for Content. This is NEW.** Locked N8 only draws the Pay for Sale version. Draw it with: the 'ROUND 2 OF 2 · YOUR LAST' pill; Fee with its 'She asked for' line; 'What she delivers *' with the same rows; the type list opened in place inside the pop-up's scroll area (no second pop-up); the reuse switch; 'Say why (optional)'; 'Send last counter'.

**Board 4: Creator pitch form (as locked T3, item8-pitch-locked.html line 418).** Label 'What you'd deliver *', same rows.

**Board 5 (small): the pitch counter screen**, used by both apps. Same as Board 2 without the locked card and without the reuse switch.

**To settle before locking:**
- whether the hint line appears on Boards 2 to 5 (locked N3 and T3 do not show it; the app shows it everywhere today);
- whether a new invitation or pitch still starts with 'Instagram reel, 1' filled in.

**Wording to keep exactly:** 'What she delivers', 'What you'll deliver', 'What you'd deliver', 'Add another', the five type names, 'Add at least one thing she delivers.'. The only new word is 'Added'.

## QUESTIONS
- Quantity: are you happy with a minus / number / plus control (1 to 20, no keyboard), or do you want to keep a box you type into? The locked board shows a plain number box.
- Dropdown style: should the list of types open in place under the field (works the same everywhere, including inside the brand's counter pop-up), or slide up from the bottom of the screen as a pop-up list?
- When all five types are already added, is it right that '+ Add another' simply disappears?
- Should a new Pay for Content invitation still start with 'Instagram reel, 1' already filled in, or start empty so the brand must choose?
- Are the five types still the full list (Instagram reel, post, story, YouTube video, YouTube short)? Adding a new type such as a Facebook post is a separate job that needs a database change; the picker redesign does not.

## TESTS
- Packages/Mobile/src/screens/brand/__tests__/item5Brand.test.js
- Packages/Mobile/src/screens/influencer/__tests__/item6Creator.test.js
- Packages/Mobile/src/screens/brand/__tests__/item6Brand.test.js
- Packages/Mobile/src/screens/influencer/__tests__/item8Creator.test.js
- Packages/Mobile/src/screens/brand/__tests__/item8Brand.test.js
