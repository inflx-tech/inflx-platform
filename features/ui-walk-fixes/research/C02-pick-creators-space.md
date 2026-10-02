# C02-pick-creators-space — Creator picker: filters crowd out the list

## TODAY
Brand app > Campaigns > a set > Add creators (All creators tab), top to bottom. Heights are estimates from the style values for a 360x760 phone (about 736 usable below the status bar); I did not run the app.

FIXED AT THE TOP (does not scroll):
1. Title bar "< Add creators" - about 101px, of which 50px is empty white space above the back arrow.
2. Small grey capitals line "DIWALI EDIT 2026 · SET A · ETHNIC WEAR" plus the four tabs "All creators | Worked with | Groups | Pool" - about 69px.
3. Search box "Search by name or @handle" - about 52px.
4. Chip row: "Open to invitations" (black when on), "Filters" (or "Filters · 2"), and when any filter is set a third chip such as "Fashion +1 ✕". The three chips do not fit on one 360px line, so the row wraps to two lines - about 49px, or 88px with a filter active.
Top total: about 271px (310px with a filter active).

INSIDE THE LIST (scrolls away, but is there on arrival):
5. Two-line grey sentence "Creators whose own settings rule this set out can't be picked, and the reason is never shown to them." - about 40px.
6. "128 creators" on the left and "Nearest first ▾" on the right - about 33px.
7. Creator cards. Each is a bordered box: photo, name, one line (niche · city · distance · languages), a round tick on the right, three numbers (Instagram / YouTube / Engagement), then outline tags (Pay for Sale, Hybrid, Store Visit...). About 172px each, about 206px when the tags wrap.

FIXED AT THE BOTTOM:
8. Footer: when someone is ticked, a line with up to three small faces, "3 selected" and an underlined "Review"; then the full-width button "Next: terms for 3 creators". About 85px empty, 119px with a selection.
9. The app's bottom tab bar (Home, Campaigns, Creators, Wallet, Profile) stays on this screen - 62px.
Bottom total: about 147-181px.

RESULT: the list window is about 318px at best and about 245px once a filter is on and someone is ticked. On arrival, after the sentence and count row, that is room for 1 to 1.4 creator cards; after scrolling, 1.4 to 1.8. With the keyboard open (about 280px) the footer and bottom tab bar both ride up above it, leaving about 38px or nothing.

The other three tabs (Worked with, Groups, Pool) use slim one-line rows and have no chip row, so they are much less cramped; the complaint is the All creators tab.

## ROOT CAUSE
Six things stack up; the filters are only one of them.

1. Chip row wraps. DiscoverList pins the search box and a wrapping chip row (flexWrap) holding three chips: a one-tap "Open to invitations", "Filters", and a summary chip. A full Filters sheet already exists and already contains the "Open to invitations only" switch, the sort, and all ten filters, so two of the three inline chips duplicate it. (DiscoverList.js:188-200, style :267-268; FiltersSheet.js:109-113)

2. Empty band in the title bar. The shared Header has a hard-coded paddingTop of 50. I found no translucent status bar setting anywhere (styles.xml has none; no StatusBar component in the app), so those 50px look like plain white space under the status bar. The same Header is imported by 85 screens. This is the one point I could not confirm without a device. (BrandPitchSettingsScreen.js:263)

3. The campaign/set line and the four tabs sit as a separate band under the title bar. (BrandSetPickCreatorsScreen.js:110-113)

4. The bottom tab bar is never hidden on pushed screens, and nothing hides it or the footer when the keyboard opens (no tabBarHideOnKeyboard, no keyboard listener anywhere in the app). (BrandNavigator.js:209-216, :137)

5. The footer is two stacked rows with 22px bottom padding. (BrandSetPickCreatorsScreen.js:127-140, style :309)

6. The cards are the full Creators-tab card. On 16 Sep the founder asked for the picker to show the same card as the Creators tab, which replaced the slim one-line rows drawn on the locked board. Each card is 3-4 times taller than the row it replaced. (DiscoverList.js:27-34, :36-79, style :279)

The 17 Sep fix moved the sentence and the count/sort row into the scrolling list (about 100px back) but left items 1-6 untouched. (features/item3-discovery-profiles-groups/lock.json:34-52)

## MOCKUP
{
 "file": "C:\\WORK\\inflx-platform\\features\\item5-invitations\\04-preview\\mockups\\item5-invitations-locked.html",
 "screen_ref": "I1 'Add creators to a set' (locked 12 Sep), amended by features/one-basket-add-creators/04-preview/mockups/one-basket-add-creators.html AFTER 1-5 (locked 17 Sep). Siblings: G5 and D1/D2 in features/item3-discovery-profiles-groups/04-preview/mockups/item3-discovery-locked.html; D1/D2 in features/creator-distance-and-visit-preference/04-preview/mockups/creator-distance-mockups-v1.html.",
 "what_mockup_shows": "A 38px title bar (back arrow, 'Add creators', a close X) with no empty band above it; the capitals line 'DIWALI EDIT 2026 · SET A · ETHNIC WEAR'; the tab strip (three tabs on I1, four with Pool after the amendment); the search box; ONE non-wrapping chip row ('Filters', 'Fashion ×', 'City ▾'); then slim one-line rows (square tick box, small photo, name, 'Fashion · Hyderabad · 48.2K IG', with 'Can't invite' / 'Invited' chips on locked rows) - five creators visible on a 300x600 frame; the hint sentence BELOW the rows; a footer with the single button 'Next: terms for 3 creators' (the amendment adds the faces / 'N selected' / 'Review' line above it). No bottom tab bar on I1, on G5, or on any pushed brand screen I1-I10.",
 "live_matches_mockup": "partly",
 "difference": "Wording, tabs, and the basket footer match. The layout does not: (1) live cards are the full three-row Creators-tab card, not the slim one-line row - a deliberate founder change on 16 Sep that was never redrawn on a board; (2) live shows the bottom tab bar, the board does not; (3) live title bar is about 101px with a 50px empty band, the board's is 38px; (4) live chip row has an extra 'Open to invitations' chip and wraps to two lines, the board has one non-wrapping row; (5) live puts the hint sentence and a count/sort row ABOVE the first creator, the board puts the hint below the list and has no count/sort row on I1; (6) the board's close X in the title bar is not built."
}

## CORRECTIONS
- Overstated: 'a filter-chip row that wraps to two lines'. With no filter set there are only two chips ('Open to invitations' + 'Filters'), about 233px of the 324px available, so the row is ONE line on arrival (about 49px). It wraps only once the third summary chip appears, i.e. after a filter is applied. DiscoverList.js:190-200, style :267-268. The what_user_sees section says this correctly; plain_verdict and root_cause #1 do not.
- Overstated: 'With C on top: about 5 creators visible'. From the investigator's own numbers: after A+B the list window is about 454px (736 - 207 top - 75 footer); minus the 33px count row and with 92px rows + 8px gap that is about 4.2 rows on arrival, about 3.9 with the basket line showing; about 4.6 only if the header band (D) is also removed. Say 'about 4'.
- Option C's 'tags on a single non-wrapping line' cannot hold all tags. The test creator in item5Brand.test.js:542-543 has five ('Pay for Sale', 'Pay for Content', 'Hybrid', '📍 Store Visit', 'Remote'), roughly 450px of tags against about 294px of row width (primitives.js:227-228 tag metrics). A non-wrapping line would cut off facts the founder asked to see on 16 Sep (commit a744591c).
- 'Hint goes BELOW the list, as on the locked I1 board' is not equivalent in the live app: the list is an infinite-scroll FlatList (DiscoverList.js:215-237, onEndReached paging), so a ListFooterComponent is effectively never reached with 128 creators. The I1 board only shows it because it draws five rows. The jest check at item5Brand.test.js:145 would still pass (FlatList renders the footer in tests) while a real user never sees the sentence.
- Option D files_touched is incomplete. The hard-coded top padding is also on the creator app's tab roots and shells: screens/influencer/CollabsScreen.js:53, screens/influencer/CreatorWalletScreen.js:65 and :95, screens/create/CreateHomeScreen.js:172, screens/influencer/ProfileScreen.js:139, components/shell/PendingHomeScreen.js:148, components/shell/ComingSoonScreen.js:43, components/brand/ScreenHeader.js:62 (plus BrandWalletScreen.js:84 and :105, both lines). Fixing only the shared Header and the four brand roots would make titles jump between tab roots and pushed screens in the creator app.
- Option C files_touched omits a coupling: components/discovery/BrandList.js:14 imports the style object `s` from DiscoverList and uses s.card / s.cardTop / s.name / s.meta / s.controls / s.quick / s.qchip / s.countRow (BrandList.js:22-36, 78-93). Editing those shared styles for the picker silently restyles the creator app's Find brands list. The lock.json note 'the creator app uses only LoadErrorList from that file' (item3 lock.json:47) is itself wrong for the same reason.
- 'Locked 17 Sep amendment ... footer with faces above Next' is right for lock.json (one-basket-add-creators/lock.json:10-12) but the cited AFTER 1 frame (one-basket-add-creators.html:396-411) is the POOL tab. The All-creators tab on that board appears only as 'TODAY 1' (:339-353), with no chip row and a single-button footer. No locked board draws the All-creators tab with the basket footer, and the HTML header still reads 'awaiting lock' (:326).
- 'Live chip row has an extra Open to invitations chip' is true against I1 and G5 only. The item 3 D1 board (item3-discovery-locked.html:275) draws 'Open to invitations' as the FIRST quick chip and D3 (:283-289) draws it turned off as a named state, so removing it departs from a locked board rather than restoring one. The newest locked board for these rows (creator-distance-mockups-v1.html:41, locked 19 Sep) draws yet another chip row: 'Nearest first', 'Anywhere ▾', 'Filters'.
- Status-bar claim: the investigator hedged; the code evidence is stronger than stated. Android-only (no ios folder under Packages/Mobile), targetSdkVersion 34 (android/build.gradle:6, so Android 15 edge-to-edge is not enforced), MainActivity.kt has no window flags, styles.xml:4-7 has no translucent item, zero StatusBar usages in app JS, react-native-screens 3.31.1 only goes translucent when a screen asks. So the 50px in BrandPitchSettingsScreen.js:263 is blank space on every phone, as far as code can show. Still not device-verified.
- 'Returns about 35-40px' for D: with a zero top inset the saving is the full 50 minus whatever small padding is kept, i.e. about 42-44px.
- Confirmed as cited (no change needed): Header imported by exactly 85 files; tab bar 62px and never hidden (BrandNavigator.js:209-216), no tabBarHideOnKeyboard and no Keyboard listener anywhere in src; adjustResize in AndroidManifest.xml:20; footer style BrandSetPickCreatorsScreen.js:309; FiltersSheet already holds the open-only switch and sort (:109-113); the set-creation flow lands on this exact screen (BrandSetEditScreen.js:116 -> BrandSetDetailScreen.js:67-75 -> BrandSetPickCreators), so this is the screen the founder meant.

## MISSED SITES
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\brand\__tests__\item5Brand.test.js :: Lines 540-560 'shows the same card as the Creators tab' encode the founder's 16 Sep note: separate text nodes '193.2K' / 'Instagram' / '52.0K' / 'YouTube' / '5.1%' / 'Engagement' and all five tags. Any compact row that merges these into one line breaks this test; it may only be rewritten to the newly locked layout with every number and every tag still asserted (no-fake-green).
- C:\WORK\inflx-platform\Packages\Mobile\src\components\discovery\BrandList.js :: Line 14 imports the shared style object `s` from DiscoverList. Any edit to DiscoverList's exported styles restyles the creator app's Find brands cards and controls. Needs an influencer OTA and its own before/after check.
- C:\WORK\inflx-platform\Packages\Mobile\src\navigation\InfluencerNavigator.js :: Lines 76 and 221 reuse tabScreenOptions from BrandNavigator. Adding tabBarHideOnKeyboard or a hide-tab-bar rule inside that shared function changes the creator app too.
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\brand\BrandCreatorTermsScreen.js :: Next screen in the same flow (and BrandReviewSendScreen.js after it): absolute footer plus the tab bar. Locked boards I3-I8 draw no tab bar. Hiding the bar on the picker only makes it pop back one tap later; decide for the whole invite flow.
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\influencer\CollabsScreen.js :: Line 53 paddingTop 54. Same hard-coded top band on creator tab roots: CreatorWalletScreen.js:65,95; create/CreateHomeScreen.js:172; influencer/ProfileScreen.js:139; shell/PendingHomeScreen.js:148; shell/ComingSoonScreen.js:43; components/brand/ScreenHeader.js:62. All missing from option D.
- C:\WORK\inflx-platform\Packages\Mobile\src\components\discovery\DiscoverList.js :: Lines 201-209 vs 228: the sort menu opens inside the PINNED controls while its 'Nearest first ▾' toggle lives in the scrolling list header. Once scrolled the toggle is gone, and when opened the four-item menu pushes the list down about 165px. Left over from the 17 Sep fix; the redraw should give sort one home.
- C:\WORK\inflx-platform\features\creator-distance-and-visit-preference\04-preview\mockups\creator-distance-mockups-v1.html :: Lines 38-49, locked 19 Sep: the newest locked board for the Discover/picker rows. Slim one-line cards, chip row 'Nearest first / Anywhere ▾ / Filters', caption says the same row appears in the set picker and add-to-group. Three locked boards (I1, G5, this D1) show slim rows; none shows the full card that is live.
- C:\WORK\inflx-platform\Packages\Mobile\src\components\discovery\__tests__\distance.test.js :: Line 108 asserts the summary chip text 'Within 50 km  ✕'; line 125 unit-tests quickChip(). This is the only assertion option A breaks. No test presses quick-open or quick-canpitch, and nothing under qa/ references these controls.
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\brand\BrandGroupAddCreatorsScreen.js :: Already listed by the investigator, but note two extra differences from locked G5: the live footer has a capacity line (:79) the board does not draw, and defaultOpenOnly is false here (:73), so with the chip removed 'show only open creators' becomes a two-tap action on this screen.

## FIX RISKS
- Shared styles: BrandList.js imports `s` from DiscoverList. Build the compact pick row and the one-row controls as NEW styles/components; do not edit s.card, s.quick, s.qchip, s.controls in place or the creator app's Find brands changes without being drawn or tested.
- Shared tab options: tabScreenOptions (BrandNavigator.js:209) is used by the creator app. Hide the tab bar through per-Tab.Screen options in BrandNavigator (CampaignsTab and CreatorsTab both need it, because BrandGroupAddCreators sits in the Creators stack), and remember a per-screen tabBarStyle REPLACES the base style rather than merging, so the 62px/border style must be repeated.
- Hiding the tab bar on a pushed native-stack screen makes the outgoing screen grow by 62px mid-transition (visible jump), and the bar reappears on the very next screen (creator terms, review and send) unless the whole invite flow is covered. Needs a phone look; jest cannot see it (item3Navigators.test.js mocks the navigators).
- tabBarHideOnKeyboard and a keyboard-aware footer overlap with the founder's separate keyboard-covers-the-field issue. Two contracts editing BrandNavigator.js and the footer pattern (34 files use the same absolute bottom bar) will collide; do the tab-bar-on-keyboard change once, in one place, for both apps.
- Hiding the footer while the keyboard is open removes 'Next: terms for N creators' and the basket line while typing. Acceptable (the list already dismisses the keyboard on drag) but it is new behaviour and must be on the drawn keyboard state.
- Compact row vs the 16 Sep founder request: item5Brand.test.js:546-560 must be rewritten, not weakened - every number and every Aim/mode tag still asserted. A single-line tag strip that clips is a regression of that request.
- Moving the hint to the list footer passes the existing test (item5Brand.test.js:145) while hiding the sentence from real users behind infinite scroll - a green test over a lost rule.
- Removing the 'Open to invitations' chip departs from locked D1/D3. On the set picker the state stays visible because turning it off shows 'Filters · 1' (changedCount counts openOnly, FiltersSheet.js:21-28); on the group picker the default is off, so nothing on the main screen says whether the list is restricted.
- Folding the campaign/set line into the shared Header must be an optional prop (85 importers) with one-line truncation; long campaign names otherwise push the title bar taller and undo the saving. The exact string 'DIWALI EDIT 2026 · SET A · ETHNIC WEAR' must remain one Text node for item5Brand.test.js:144 and :573.
- Option D moves every pushed screen and every tab root in two apps. Every stored before/after capture and Maestro screenshot shifts; it needs its own contract, drawn boards and a device check. If done with the safe-area inset, jest.setup.js:36 already returns zero insets so tests will not notice a mistake.
- Governance: any commit under Packages/Mobile/src needs the three mockup_locked fields and a non-empty 06-diff/notes.md, and a release flip needs maestro_green. The I1, G5, D1 (and F2 if Find brands is included) boards all have to be redrawn and re-locked first, because each of them draws the chip row this fix removes.
- No backend, migration or native-rebuild risk found: openOnly/sort/within still travel as the same query params; @react-navigation/bottom-tabs 6.6.1 supports tabBarHideOnKeyboard in JS; react-native-safe-area-context 4.14.1 and the Keyboard API are already in the installed apps. Brand OTA and influencer OTA are both required once shared files change.

## FIX FINAL
One contract for the pickers, JS-only, shipped as brand OTA plus influencer OTA (shared files), no backend, no migration, no rebuild. Draw and lock first; then build in this order.

1. Tab bar and footer (largest sure win, about 62px always and about 150px while typing). In BrandNavigator.js hide the bottom tab bar, via per-Tab.Screen options keyed on the focused route, for the whole invite flow - BrandSetPickCreators, BrandGroupInviteCheck, BrandCreatorTerms, BrandReviewSend - and for BrandGroupAddCreators in the Creators stack. Add tabBarHideOnKeyboard to the shared tab options once, for both apps, coordinated with the keyboard issue. Hide the picker footer while the keyboard is up. Tighten footer padding (BrandSetPickCreatorsScreen.js:309, BrandGroupAddCreatorsScreen.js:133).

2. One control row (about 49px, 88px when a filter is on). Search box with a single Filters button beside it ('Filters · N' when set); 'Open to invitations' lives in the sheet only; a 'Clear all' link on the count row replaces the summary chip. Apply to DiscoverList and BrandList, and move BrandList's count/sort row into its scrolling list (it never got the 17 Sep fix). Use new style names; do not mutate the exported `s`. Update distance.test.js:108 to the new affordance and keep the quickChip unit check.

3. Title bar: add an optional second line to the shared Header and move the capitals campaign/set line into it (about 24px). Backward compatible for the other 84 screens.

4. Creator rows: only after the founder chooses between two drawn variants - (a) compact pick row with every number and a tag line that ends in '+N' when it overflows, or (b) the current card tightened (smaller padding and gaps, same three parts). Build it as a new select-mode row; leave the Creators-tab card and BrandCard untouched. Rewrite item5Brand.test.js:546-560 to the chosen layout with all numbers and all tags still asserted.

5. Keep the 'can't be picked' sentence where it scrolls away at the top of the list (or show a one-line note only when a locked row is present). Do not move it to the end of an infinite list. Give sort a single home so the menu no longer opens in the pinned area.

6. The 50px empty band above every title: do NOT fold into this contract. Get one screenshot from the founder's phone to confirm it is blank, then run it as its own contract covering the shared Header and every tab root and shell in BOTH apps (list in missed_sites), using the real status-bar inset.

Honest expected result on a 360x760 phone, from style values, not measured: today about 245-318px of list (1 to 1.8 creators); after steps 1-3 about 450px; with the chosen row about 4 creators (3.5 if tags take two lines); about 40px more if step 6 is later approved.

## DRAW FINAL
Draw at 360x760, brand app, white/black with colour only on status chips. Main button as the app ships it today and as the locked item 5 board draws it: yellow with a black label (tokens.js:507-512) - flag this for the founder if the mono rule now says otherwise. Every frame shows the phone's status bar so the top spacing is honest.

BOARD 1 - 'Add creators' for a set, All creators tab (replaces I1). Show a TODAY frame beside each AFTER frame.
(a) Arrival, nothing ticked, no filter. Title bar: back arrow, 'Add creators', and under it one small capitals line 'DIWALI EDIT 2026 · SET A · ETHNIC WEAR' (cut with … if long). Tabs 'All creators | Worked with | Groups | Pool'. ONE control row: search 'Search by name or @handle' with a 'Filters' button at its right. Then the list: first line inside it '128 creators' left and 'Nearest first ▾' right; the sentence 'Creators whose own settings rule this set out can't be picked, and the reason is never shown to them.' as a scrolling line at the top of the list (not at the end). Rows as chosen below, including one greyed row 'Not open to this set' + chip 'Can't invite' and one ticked-and-locked row 'Already in this set' + chip 'Invited'. Footer: disabled 'Next: terms for 0 creators'. NO bottom tab bar.
(b) Three ticked, two filters on. Button reads 'Filters · 2'; count row '14 creators' with a small 'Clear all'; footer line with three faces, '3 selected', underlined 'Review', then 'Next: terms for 3 creators'.
(c) Filters sheet open, content unchanged: 'Filters', 'Clear all', switch 'Open to invitations only', Sort (Nearest first / Most followers / Highest engagement / Newest), 'Distance from your main branch' (Within 50 km / Within 100 km / Same state / Anywhere), Niche, Instagram followers, YouTube subscribers, Engagement, City, Language, Open to Aims, Mode of work, button 'Show 14 creators'.
(d) Keyboard open while searching: title bar, tabs, control row, list down to the keyboard; footer and tab bar hidden.

ROW CHOICE - draw both on frame (a), using a creator with all five tags (Pay for Sale, Pay for Content, Hybrid, Store Visit, Remote) so nothing is flattered:
 Variant 1, compact pick row: photo, name, round tick; 'Fashion · Guntur · 32 km'; '48.2K IG · 12.1K YT · 4.2% eng'; one tag line ending '+2' when it overflows. Show how many rows really fit (about 4).
 Variant 2, tightened card: today's three-part card (three numbers with labels, wrapping tags) with smaller padding and gaps. Show how many fit (about 2.5 to 3).

BOARD 2 - the two screens that follow, 'Terms · Priya Sharma' and 'Review and send', drawn only to show the bottom tab bar is also gone there (as on locked I3-I8), so the founder approves the whole flow and not one screen.

BOARD 3 - 'Add creators' to a group (replaces G5): title bar with second line 'Adding to Diwali shortlist · 12 creators'; tabs 'All creators | Worked with'; same control row; same row variant with a locked row 'Already in this group'; footer 'Diwali shortlist can take 88 more creators.' above 'Add 3 creators'. No tab bar. Note on the board that 'Open to invitations' is off by default here and lives in the sheet.

BOARD 4 - Creators tab > Discover (replaces D1): title 'Creators', tabs 'Discover | Groups | Pitches | Worked with', the single control row, count/sort line, FULL creator card unchanged with the add-to-group plus. Bottom tab bar stays (tab root).

BOARD 5 - Creator app 'Find brands' (replaces F2): title bar, control row 'Search brands' + 'Filters', '42 brands' / 'Newest ▾' inside the list, brand cards unchanged; the sheet keeps the 'Brands I can pitch' switch.

SEPARATE DECISION FRAME (not part of the lock unless approved): Board 1(a) drawn twice, with and without the empty band above the title, labelled 'affects every screen in both apps - confirm with a phone screenshot first'.

Call out on the boards what changes: chip row gone; 'Open to invitations' only in the sheet; campaign/set line inside the title bar; no bottom tab bar through the invite flow; footer hidden while typing; row variant chosen by the founder; the 'can't be picked' sentence stays at the top of the list.

## QUESTIONS
- On 16 Sep you asked for the picker to show the same card as the Creators tab. Are you happy with a compact pick row that keeps the same facts (followers, engagement, Aim and mode tags) in about half the height, with the full card staying on the Creators tab?
- Is it fine for 'Open to invitations' to live only inside the Filters sheet (two taps to turn off) so the chip row can go? In the set picker it is on by default.
- Should the bottom tab bar (Home / Campaigns / Creators / Wallet / Profile) be hidden on the two 'Add creators' screens, as the locked boards draw them? Or on every pushed screen, which is a bigger change?
- The title bar on every pushed screen appears to carry about 50px of empty space at the top. Fix it everywhere now (85 screens move up, needs a phone check), or only tighten the pickers in this round?
- Should the creator app's 'Find brands' list get the same single-row treatment in this round? It never received the 17 Sep fix.
- The locked I1 board has a close X in the title bar that was never built. Keep it off, or add it?
- The code's main-button colour is yellow with a black label, while the brief for this work says main buttons are black with white labels. Which should the new boards show?

## TESTS
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\brand\__tests__\item5Brand.test.js
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\brand\__tests__\item3Brand.test.js
- C:\WORK\inflx-platform\Packages\Mobile\src\components\discovery\__tests__\distance.test.js
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\influencer\__tests__\item3Creator.test.js
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\brand\__tests__\item4Brand.test.js
