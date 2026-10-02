# C03-keyboard-covers-input — Keyboard hides the text field being typed in

## TODAY
I could not run the app (read-only), so this is worked out from the layout code and the React Native source, not seen on a phone.

Example: brand app, Shoot plan, tap "Their number" (same pattern on about 15 screens). Top to bottom with the keypad open:
1. A 100-point-tall header (back arrow + title; it carries 50 points of empty space above the title).
2. The scrolling form, squeezed into what is left.
3. The pinned main button bar ("Send to <name>"), about 84 points tall, floating OVER the bottom of the form.
4. The bottom tab bar (Home / Campaigns / Creators / Wallet / Profile), 62 points, still showing.
5. The keypad.
Android scrolls the tapped field to the bottom edge of the form area, which is underneath the floating button bar. So the user sees header, a bit of form, the button, the tabs and the keypad, but not the box being typed in. On an 800-point phone only about 220 points of form stay visible; on a small phone the second field of even "New campaign" lands fully behind the button.

Pop-up sheets: the sheet does rise above the keypad, but it cannot shrink or scroll. A tall sheet (brand "Send counter", "Move the time") keeps its top on screen and its lower part, where the "Say why" note box and the Send button are, slides under the keypad.

Fields at the top of a screen (set name, campaign name, withdraw amount, every search box) stay visible. The shopper app is not affected in the same way: its forms have no floating bar and no tab bar under them.

My count of 68 places where a user types (screens + sheets), classified from layout structure: 18 broken, 14 at risk, 36 safe.
- Broken screens (15): BrandCreatorTerms, BrandShootPlan, BrandRemoteBook, PitchCounter, ShootCounter, Counter, MoveRequest, Content, SaleLive, RemoteShoot, BrandPitchSettings, InvitationSettings, BrandBusinessDetails, BrandBranchEdit, ProfileInfo.
- Broken sheets (3): BrandCounterSheet6, MoveTimeSheet10, ConfirmReturnSheet11.
- At risk (14): BrandCampaignNew, BrandSetEdit, BrandRemoteProducts, BrandLinks, NicheLanguages, FollowerLogin; sheets DeclineSheet5, DeclineAgreementSheet7, ReportSheet14, CreatorSignSheet7, BrandSignSheet7, RejectPitchSheet8, DuplicateSheet4, ChooseProductsModal.
- Safe (36): all auth screens, all shopper screens except FollowerLogin, PitchForm, RemoteAddress, AddMoney, both payout-detail screens, ChangeNumber, Withdraw, the create screens, every search box, and 10 short or search-on-top sheets.

## ROOT CAUSE
The native setup is fine. The manifest has adjustResize, MainActivity is stock, and nothing in src uses a translucent status bar or edge-to-edge (targetSdk 34), so the window does shrink when the keypad opens. React Native's pop-up window (Modal) also sets adjustResize on itself. The defect is in our layout, in four parts:

1. Floating button bars. The pinned action bar is drawn as an overlay (`position: 'absolute', bottom: 0`) on top of the ScrollView in about 35 screens, plus the shared SaveBar. With the keypad open the bar sits directly above the keypad and covers the bottom 84 to 150 points of the scroll area. Android's ScrollView scrolls the focused field only as far as the bottom edge of its own frame, which is behind that bar. The `paddingBottom: 120/140/190` on those ScrollViews only helps when the user scrolls by hand to the very end.

2. The tab bar stays up. Every brand and creator screen lives in a stack inside the bottom tabs, and `tabBarHideOnKeyboard` is not set, so the 62-point tab bar also rides above the keypad.

3. Sheets cannot shrink. The shared `Sheet` is a flexible scrim plus a fixed-height box with no maximum height and no scrolling. Inner lists use hard heights (`maxHeight: 440/460/380/360/320`). When the sheet is taller than the space above the keypad, its bottom part goes under the keypad.

4. No shared keyboard handling. Nothing in src listens to keyboard events. Of the 14 files that use KeyboardAvoidingView, 9 pass `behavior: undefined` on Android (which does nothing) and the 5 auth screens pass 'height' on top of adjustResize. The auth screens work because their button bar is in the normal layout, not floating.

Secondary: the shared header is 100 points tall, and several ScrollViews that hold inputs lack `keyboardShouldPersistTaps` (PostReview, NewCollection, RemoteShoot, order cancel, ConfirmReturnSheet11), so the first tap on a button only closes the keypad.

## MOCKUP
{
 "file": "C:\\WORK\\inflx-platform\\features\\item4-campaigns-sets\\04-preview\\mockups\\item4-campaigns-sets-locked.html",
 "screen_ref": "All frames (.phone / .scr / .tabbar, CSS lines 46-48 and 126). Same frame CSS in item10-store-visit-locked.html; item5/6/7/12 boards have no keypad frame either.",
 "what_mockup_shows": "Every locked board draws screens at rest: status bar, a content column with the main button at the end of the content, and the tab bar at the bottom. No frame on the item 4, 5, 6, 7, 10 or 12 boards shows the keypad open (a search for keyboard/keypad in those boards finds nothing), and no frame draws the button as an overlay on top of the content.",
 "live_matches_mockup": "no_mockup_found",
 "difference": "There is no agreed picture of any screen with the keypad open, so the live behaviour was never specified. The floating button bar and the tab bar staying above the keypad are implementation choices, not something a board asked for."
}

## CORRECTIONS
- Nothing was observed on a device, by the investigator or by me. The mechanism is derived from layout code plus Android's ScrollView behaviour, so 'CONFIRMED' means confirmed by code reading. A real-phone check of one screen (BrandShootPlan, 'Their number') is needed to prove it is the pinned bar and not the keypad itself that hides the field.
- The locked-mockup description is wrong. The boards do not draw 'the main button at the end of the content, and the tab bar at the bottom'. They define a separate bordered button strip, `.savebar` (features/item4-campaigns-sets/04-preview/mockups/item4-campaigns-sets-locked.html:98, same line in item10; item2 board line 101), laid out in normal flow under the content. It appears on 34 frames: item2 B2/B3/B6/C2/C3, item4 C3/C4, item5 I1-I5/I8, item6 N2/N3/N4/N14/N15/N16/N18, item7 P2/P9/P10, item10 V1/V2, item12 C1/C3/C4/C6/C8/C9/C10/C11/C14.
- No locked frame carries both a savebar and a tab bar. The tab bar is drawn only on tab-root list frames (item4 C1/C2, item10 V4, item5 I11/I15, item2 B1/C1, item6 N12/N13, item7 P4/P16). The live app shows the 62-point tab bar on every pushed screen (Packages/Mobile/src/navigation/BrandNavigator.js:126-161 nested under :224). So 'no_mockup_found' holds only for the keypad-open state; at rest, live already differs from the boards on bar placement and on the tab bar.
- Header height: the boards draw a 26-point status strip plus a 38-point title row (item4 board CSS lines 47-49). Live Header is paddingTop 50 + 40 + 10 = about 101 points (Packages/Mobile/src/screens/brand/BrandPitchSettingsScreen.js:263). There is no StatusBar component anywhere in src or App.js and no translucent flag, so the 50 points is dead space under an opaque status bar. This shared Header is imported by 86 files, so it is not a 'secondary' detail: on a small phone it decides whether a pinned-under-the-form button leaves any room for the field.
- ReactScrollView.java:310-316 only calls super.onSizeChanged. The 'scroll the focused field into view when the window resizes' logic lives in Android's own android.widget.ScrollView.onSizeChanged, not in the cited React Native file. Lines 344-377 (requestChildFocus / scrollToChild) are cited correctly. The conclusion (field is aligned to the bottom edge of the ScrollView frame, which is under the absolute bar) holds.
- TextField4 usage breakdown is miscounted. It is 8 screens (BrandCampaignNew, BrandCreatorTerms, BrandSetEdit, BrandShootPlan, Counter, MoveRequest, PitchCounter, ShootCounter) plus 8 sheet files (sheets4/5/6/7/10/11/12/14) = 16, not '11 screens and 8 sheet files minus overlaps' (Packages/Mobile/src/components/campaigns/bits4.js:46).
- The claim that Option A 'relies on layout plus Android's own auto-scroll, not on keyboard events' is not true for its tab-bar step. tabBarHideOnKeyboard is driven by keyboardDidShow / keyboardDidHide (Packages/Mobile/node_modules/@react-navigation/bottom-tabs/src/utils/useIsKeyboardShown.tsx:18-22; BottomTabBar.tsx:155-159). On Android those fire after the window has already resized, so the tab bar shows above the keypad for a moment and then slides away. The investigator attributed that flash only to Option B.
- 'FormScroll ... a little breathing room under the focused field' cannot come from Android's auto-scroll. It aligns the TextInput's own bottom edge flush with the scroll frame (no fading edge, no offset setting). The counter, hint and error lines that TextField4 renders below the input (bits4.js:56-58) will sit below the visible edge. Frame 2's 'field, counter and error line visible' needs a small JS focus helper, which does depend on keyboard events.
- SaveBar has 8 screen users, not 7: the 7 with inputs plus BrandSubCategoriesScreen (Packages/Mobile/src/screens/brand/BrandSubCategoriesScreen.js:58,71). It has no input but changes when SaveBar goes in-flow (its paddingBottom 140 becomes empty space). It is missing from files_touched.
- All other citations I re-opened are accurate: AndroidManifest.xml:15-21, MainActivity.kt:8-22, ReactModalHostView.java:325 and 357-361, BrandShootPlanScreen.js:89-116/127, ContentScreen.js:193/249-251/298-300/335/380, BrandCreatorTermsScreen.js:85/93/101/126-132/146/206, feedback.js:17-31/90, BrandNavigator.js:209-216/224, sheets.js:13-20/118-120, sheets6.js:96-138, sheets10.js:49-59, sheets11.js:190-203 with bits11.js:231-242, FollowerNavigator.js:63-114. The 14 KeyboardAvoidingView files (9 undefined, 5 'height'), the 50 TextInput files and the six dead files were also confirmed by search.

## MISSED SITES
- C:\WORK\inflx-platform\Packages\Mobile\src\components\create\bitsCreate.js :: Lines 75-81 and 108: the Create tab's shared `Footer` is already an in-flow pinned button bar (border-top, no position:absolute), used by PostReviewScreen:78 and NewCollectionScreen:94. This is the fix pattern already live in the creator app, which is why the create screens are 'safe'. Reuse or extend it rather than inventing a second footer.
- C:\WORK\inflx-platform\Packages\Mobile\src\components\content\sheets12.js :: ChangesSheet12 (:62), NoteSheet12 (:87) and ReportSheet12 (:114) each hold a multiline note in the non-scrolling Sheet. They are not in any of the investigator's lists. They fit on a normal phone, but on a small phone the Send / Report buttons go under the keypad. Covered by the shared Sheet fix; must be on the walk list.
- C:\WORK\inflx-platform\Packages\Mobile\src\components\negotiation\sheets6.js :: DeclineCounterSheet6 (:154-161): note field with hint, then two buttons, in the same non-scrolling Sheet. Not listed by the investigator.
- C:\WORK\inflx-platform\Packages\Mobile\src\components\remote\sheets11.js :: SelfSentSheet11 (:103-109) has a note field. Not listed.
- C:\WORK\inflx-platform\Packages\Mobile\src\components\settings\sheets.js :: PickerSheet (:44-82): search on top, FlatList with fixed maxHeight 360, then the Apply button. With the keypad open the Apply button and the list bottom go under the keypad. Classed 'safe' because the search stays visible, but the button is unreachable until the keypad is closed. Same shape in StateCityPicker.js:84/104/141 and OfferedStateCityFields.js:68.
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\brand\BrandSubCategoriesScreen.js :: Uses SaveBar (:71) with paddingBottom 140 (:58) and no input. Affected by the SaveBar change; absent from files_touched.
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\influencer\ContentScreen.js :: Lines 251 and 300: the caption and 'Paste the link' fields save only on onEndEditing (blur). The pinned 'I've posted everything' button (:346) is outside the ScrollView, so tapping it with the keypad open does not blur the field; the link is not saved and c.can.markPosted stays false. Same pattern in SaleLiveScreen.js:330/375/432. This is the founder's separate 'button not enabled after pasting the link' issue and it interacts with any fix that keeps the button visible while typing.
- C:\WORK\inflx-platform\Packages\Mobile\src\navigation\InfluencerNavigator.js :: Lines 76 and 221: imports tabScreenOptions from BrandNavigator. The one-line tab-bar change lands in the creator app as well as the brand app. FollowerNavigator.js:66-76 has its own options and is untouched.
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\brand\BrandPitchSettingsScreen.js :: Line 263: the shared Header's 50 points of top padding is imported by 86 files. Another 15 tab-root screens hard-code paddingTop 52-56 (e.g. BrandCampaignsScreen.js:49, CollabsScreen.js:53, components/brand/ScreenHeader.js:62). Any header trim is an app-wide visual change shared with the 'use the screen space better' issue.

## FIX RISKS
- Overlap with sibling issues in the same founder batch. BrandCreatorTermsScreen + DeliverablesEditor5 (deliverables redesign), BrandShootPlanScreen + TimePicker10 + MoveTimeSheet10 (time picker), BrandSetPickCreatorsScreen (creator list space), BrandSetEditScreen (set-name suggestion) and ContentScreen / SaleLiveScreen (posted button) are all being redrawn. Separate contracts editing the same files invite merge conflicts and contradictory locked boards; use one contract or a strict order, and draw the keypad-open frames on the new layouts.
- Save-on-blur collision. Keeping the main button visible above the keypad makes it tappable while a link or caption field is still focused; ContentScreen.js:251/300 and SaleLiveScreen save only on blur, so the tap acts on stale data or the button stays disabled. Fix together with the 'posted everything' issue (save on change, or blur before press).
- tabBarHideOnKeyboard flashes on Android (the tab bar shows above the keypad, then slides away; it comes back after the keypad closes) and applies to both brand and creator apps through the shared tabScreenOptions. Unverified: whether it also fires when the keypad opens inside a pop-up sheet. The boards point to an alternative: no tab bar on pushed form screens at all, which avoids the flash but is a visible navigation change needing the founder's yes.
- Small phones. With an in-flow footer, a 640-point phone has roughly 308 points above the keypad; minus the 101-point header and an 84 to 150 point bar (ContentScreen and BrandRemoteBook bars carry a hint line or second button) that leaves about 57 to 120 points of form. A multiline note (84 + label + counter) may not fit. Needs the header trim, or the bar stepping away on short windows; decide on the board.
- The shared Sheet is imported by 18 files (17 feature files plus StateCityPicker) and also wraps PickerSheet / ConfirmSheet / ActionSheet, PendingSheetHost and PendingHomeScreen. Sheets containing a FlatList (sheets.js:60, StateCityPicker.js:84/104/141, OfferedStateCityFields.js:68) must not be wrapped in a ScrollView; they need a shrinkable list instead. A blanket change to Sheet alters every pop-up in both apps.
- Jest proves nothing here. No test asserts on bar position, padding, the tab bar or sheet height (only the `save-bar-fix` testID is referenced in pitchSettings / invitationSettings / distance tests), and Jest cannot show a keypad. The listed 27 test files will stay green whether or not the fix works; a real-phone walk is the only proof.
- Two static tests can fail on a careless edit. src/__tests__/hooksBeforeReturns.test.js: any new hook (e.g. a keyboard-visible hook) must sit above the early loading/error returns, such as BrandShootPlanScreen.js:51-52. src/utils/__tests__/importsResolve.test.js: every import of the new shared file must resolve exactly.
- Dropping KeyboardAvoidingView 'height' on the 5 auth screens changes login and registration for brand and creator. They are classed as working today, so this adds regression surface for no founder-visible gain; leave it out unless the blank-gap problem is actually seen on a phone.
- The ConfirmReturnSheet11 note fix is not a pure layout fix. The sheet's onConfirm sends only {lineId, status} (sheets11.js:211). I did not check whether the backend confirm-return endpoint accepts a note; if not, it needs a backend change or the note box should be removed. Keep it as a separate adjacent item.
- Governance and release. The change touches Packages/Mobile/src, so it needs an approved contract, a locked board, 06-diff notes and Maestro green before release; it ships as OTA for brand and creator, published one at a time. No native rebuild (tabBarHideOnKeyboard exists in the installed bottom-tabs 6.6.1; there is no iOS project). No shopper OTA is needed.
- Removing the absolute bar leaves the old bottom padding (paddingBottom 120/140/150/190, spacer height 120 in BrandPitchSettingsScreen.js:189 and InvitationSettingsScreen.js:245) as dead scroll space on every touched screen. The toast in feedback.js:92 is positioned at bottom 110 on the assumption of a floating bar; re-check it.

## FIX FINAL
Option A stands, with these changes.

0. **Prove it first.** Before any board is locked, open brand Shoot plan on a real phone, tap "Their number", and confirm it is the button bar and tab bar (not the keypad) covering the field. Everything below rests on code reading.

1. **Pinned button bar goes under the form, never over it.** This is what 34 locked frames already draw (`.savebar`), and the Create tab's `Footer` (components/create/bitsCreate.js:75-81) already does it. Extend that into the shared footer, switch SaveBar (8 screens, including BrandSubCategories) and the roughly 14 screens with their own absolute bar plus ChooseProductsModal to it, and remove the now-dead bottom padding.

2. **Tab bar: founder decision.** Either (a) hide it while the keypad is open (`tabBarHideOnKeyboard: true` in the shared tabScreenOptions; one line, both apps, brief flash), or (b) hide it on pushed form screens altogether, as the boards draw them (no flash, 62 points back permanently, but a visible navigation change). I recommend (a) now and raising (b) under the screen-space issue.

3. **Shared Sheet shrinks.** Give it a maximum height and let it shrink, with an opt-in scrolling body. Sheets that contain a FlatList get a shrinkable list, not a ScrollView wrapper. Drop the fixed maxHeight 440/460/380/360/320 on inner lists. This covers the three "broken" sheets plus sheets12, DeclineCounterSheet6, SelfSentSheet11 and the sign/decline/report sheets.

4. **Small focus helper** so the counter, hint and error lines under a field are visible, not just the input. JS only, used on screens; do not rely on it inside pop-ups.

5. **Header.** Trim the 50 points of dead space in the shared Header as part of the screen-space issue, but decide it on this board, because on a small phone it determines whether the field and the button both fit.

6. **Build together with the sibling issues** that touch the same screens. In particular, fix the save-only-on-blur behaviour of the Content and Sale link fields in the same piece of work, or the visible button will act on unsaved text.

7. **Leave out:** the auth-screen KeyboardAvoidingView change and the six dead files. Treat the "What came back?" note that discards typing as a separate adjacent fix after checking the backend accepts a note.

No native rebuild, no migration, no backend change for the layout work. Ships over the air to brand and creator, one at a time. Jest stays green regardless, so sign-off is a real-phone walk on a small and a normal phone, plus Maestro green.

## DRAW FINAL
One board, "Typing with the keypad open", brand and creator, white/black mono, ink primary buttons. Base every frame on the existing locked frame for that screen (same `.sb` / `.bar` / `.scr` / `.savebar` parts) and add a keypad block of about 40% of the height. Where a sibling issue is redrawing a screen (Terms deliverables, shoot time picker, pick creators, content links), use the new layout or draw this board after those are agreed.

Draw two phone sizes for frames 1 and 3: normal (about 360 x 800) and small (about 360 x 640). The small one is the stress case.

- **Frame 0, at rest (reference).** Shoot plan exactly as locked V2: title row, form, "Send to Tanvi" in its own strip under the form, nothing floating. Caption that this is unchanged from the locked board, and state the tab-bar decision (shown or not on pushed screens).
- **Frame 1, brand Shoot plan (item10 V2), cursor in "Their number".** Today vs fixed. Today: tall header, sliver of form, floating "Send to Tanvi" over the field, tab bar, keypad. Fixed: compact header; "Who she should ask for" above; "Their number" with its label, counter and hint fully visible; "Send to <name>" strip directly above the keypad; no tab bar while typing.
- **Frame 2, brand Terms for a creator, Pay for Content (item5 I4), cursor in the note field.** Field, "0 / 300" counter and an error line all visible above "Next creator" / "Review and send".
- **Frame 3, creator Content step, approved stage (item12 C10), cursor in "Paste the link".** Field visible; "I've posted everything" and its "to go" hint above the keypad. Show the button's state after a link is pasted, since that is the founder's separate complaint. On the small phone show what gives way (hint line or bar).
- **Frame 4, brand Pitch settings (item2 B3), cursor in a minimum-followers field with an error.** "Fix 1 thing above to save" and "Save changes" strip above the keypad.
- **Frame 5, brand "Send counter" sheet (item6 N8), cursor in "Say why (optional)".** Sheet stops below the status bar, body scrolls, note and counter visible, "Send counter" / "Send last counter" pinned at the bottom of the sheet above the keypad.
- **Frame 6, sign sheet (item7 P-frames: brand "Sign and lock <amount>", creator sign), cursor in the name field.** Name visible; the two tick lines and the sign button reachable by scrolling inside the sheet.
- **Frame 7, brand "Ask for changes" sheet (item12 C7) on the small phone.** Note field visible, "Send" reachable.
- **Frame 8, Pick creators search (item5 I1) with the keypad open.** Tab bar hidden, list gets the freed space, "Next: terms for N creators" strip above the keypad.

States to show: keypad open with field focused; keypad open with an error line under the field; keypad closed (must match today's locked boards apart from any agreed header trim).

Keep exact wording from the locked boards and copy files: "Send to <name>", "Their number", "Who she should ask for", "Next creator", "Review and send", "Paste the link", "I've posted everything", "Save changes", "Fix N things above to save", "Say why (optional)", "Send counter", "Send last counter", "Sign and lock <amount>".

## QUESTIONS
- While someone is typing, should the main button (Save / Next / Send) stay visible just above the keypad, or step away until the keypad closes? I recommend it stays, sitting under the form instead of over it.
- Is it fine for the bottom tab bar (Home / Campaigns / Creators / Wallet / Profile) to hide while the keypad is open and come back when it closes? That returns about 62 points to the form.
- Which phone did you see this on? I want the walk to cover the smallest phone you or your creators use, because small phones are hit hardest.
- Adjacent bug: on the brand's 'What came back?' sheet, picking Missing or Damaged shows a note box, but whatever is typed disappears because the sheet never stores it. Fix it in this same piece of work?
- The header on brand and creator screens is 100 points tall with 50 points of empty space above the title. Trim it here, or leave it for the 'use the screen space better' item?
- Six unused pop-up files are still in the code (DeclineSheet, ProposalFiltersSheet, CreatorOfferSheet, OfferBuilderSheet, ProductPicker, CategoryPickerModal). Leave them untouched, or remove them in a separate clean-up?

## TESTS
- Packages/Mobile/src/navigation/__tests__/item3Navigators.test.js
- Packages/Mobile/src/navigation/__tests__/lockedTab.test.js
- Packages/Mobile/src/navigation/__tests__/duplicateScreens.test.js
- Packages/Mobile/src/screens/brand/__tests__/item4Brand.test.js
- Packages/Mobile/src/screens/brand/__tests__/item5Brand.test.js
- Packages/Mobile/src/screens/brand/__tests__/item6Brand.test.js
- Packages/Mobile/src/screens/brand/__tests__/item7Brand.test.js
- Packages/Mobile/src/screens/brand/__tests__/item8Brand.test.js
- Packages/Mobile/src/screens/brand/__tests__/pitchSettings.test.js
- Packages/Mobile/src/screens/influencer/__tests__/item5Creator.test.js
- Packages/Mobile/src/screens/influencer/__tests__/item6Creator.test.js
- Packages/Mobile/src/screens/influencer/__tests__/item7Creator.test.js
- Packages/Mobile/src/screens/influencer/__tests__/item8Creator.test.js
- Packages/Mobile/src/screens/influencer/__tests__/invitationSettings.test.js
- Packages/Mobile/src/screens/influencer/__tests__/creatorTerms12.test.js
- Packages/Mobile/src/screens/__tests__/contentScreens.test.js
- Packages/Mobile/src/screens/__tests__/saleLiveScreens.test.js
- Packages/Mobile/src/screens/__tests__/remoteScreens.test.js
- Packages/Mobile/src/screens/__tests__/wallet17.test.js
- Packages/Mobile/src/screens/__tests__/registrationProfile.test.js
- Packages/Mobile/src/components/shoot/__tests__/shoot10.test.js
- Packages/Mobile/src/components/content/__tests__/content12.test.js
- Packages/Mobile/src/components/remote/__tests__/remote11.test.js
- Packages/Mobile/src/components/settings/__tests__/dangerButton.test.js
- Packages/Mobile/src/utils/__tests__/importsResolve.test.js
- Packages/Mobile/src/__tests__/hooksBeforeReturns.test.js
- Packages/Mobile/src/__tests__/accessibilityStateBooleans.test.js
