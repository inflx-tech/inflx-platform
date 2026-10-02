# C07-brand-agreement-buttons — Brand send-agreement: buttons uneven

## TODAY
BRAND, sending an agreement (read from code, not run on a device):
1) Set page: creator row with a small "Send agreement" chip. Tapping it opens the agreement preview.
2) Agreement preview (BrandAgreementScreen, preview mode), top to bottom: back arrow + title "Agreement · <first name>"; reference line "DRAFT"; card "The two of you"; card "What was agreed"; optional "Note from you"; "INFLX standard terms" row; grey hint "Nothing here can be edited..."; fixed bottom bar with ONE full-width filled button "Send for signature" (no icon). This screen is even.
3) Tapping it opens a bottom sheet: title "Send this agreement to <name>?"; grey card "What happens" (<name> signs: First / You sign: After her / Both by: date); grey hint; then TWO half-width buttons in a row: left "Not yet" (white, thin pale-grey outline, semi-bold label), right "Send" (filled, bold label). The left button starts ~10 px lower than the right one and is ~2 px taller, so neither tops nor bottoms line up. The outline is so pale that "Not yet" barely reads as a button.
4) After Send the sheet closes and the app goes straight back to the set page.

BRAND, agreement sent and she has not signed: same screen with a full-width solid red "Withdraw" bar at the bottom. Its sheet "Withdraw this agreement?" ends with "Keep it" (outline, ~10 px lower) beside "Withdraw" (solid red): same crooked pair.

BRAND, she has signed: one full-width button "Sign and lock ₹X" (or "Sign and complete"); greyed out if the wallet is short, with a red card holding "Add ₹X to wallet". The sign sheet has one full-width button. Even.

BRAND, both signed: at the bottom of the scrolling page, "Download" (outline, ~10 px lower) beside a filled button whose label changes with the visit: "Plan the visit", "The store visit", "Confirm the shoot is done" (with a tick), "Waiting on her answer — open the visit", "The visit time passed — send a new time". Each half is only about 159 dp wide on a 360 dp phone, so the longer labels wrap to 2-3 lines and make the right button much taller than "Download"; the one with the tick icon may spill past the button edge (inferred from the layout code, not seen on a device).

CREATOR agreement screen: "Sign" and "Decline" are stacked full-width with an 8 px gap. Even; not affected.

## ROOT CAUSE
The shared outline button has a top margin and a border baked into its own style; the filled and red buttons have neither. Packages/Mobile/src/components/settings/primitives.js:250 `secondary: { ... borderWidth: 1, borderColor: T.border, ..., marginTop: 10 }` versus :245 `primary: { backgroundColor: T.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }` and :254 `dangerBtn` (same as primary, no margin, no border). The margin exists because the outline button was designed to sit UNDER a filled button in a vertical stack (e.g. ConfirmSheet, sheets.js:96-99, and about 40 other stacked uses).

The agreement code puts the two side by side in a plain row without cancelling that margin: sheets7.js:35-38 (Not yet | Send), sheets7.js:182-185 (Keep it | Withdraw), BrandAgreementScreen.js:256-270 (Download | shoot button). The row style (sheets7.js:198 and BrandAgreementScreen.js:330: `{ flexDirection: 'row', gap: 10, marginTop: 4 }`) sets no alignment, so each half-cell stretches to the row height and its button sits at the top of the cell: the filled button at y=0, the outline button pushed down to y=10. The outline button is also 2 px taller (1 px border top and bottom), so the bottoms differ by ~12 px.

No button has a fixed or minimum height, no horizontal padding, and labels have no numberOfLines or textAlign (primitives.js:245-255, 141). So in the both-signed row the long labels from copy10.js:91-96 wrap inside a ~159 dp half-width button and make it 2-3 lines tall beside a one-line "Download". With an icon (BrandAgreementScreen.js:264) the label sits in a row with no shrink (primitives.js:136-139, 249), so it can overflow the button.

The locked mockup avoids all of this with a two-equal-column grid and one fixed button height (mockup lines 90-92, 218-219).

## MOCKUP
{
 "file": "C:\\WORK\\inflx-platform\\features\\item7-agreement\\04-preview\\mockups\\item7-agreement-locked.html",
 "screen_ref": "P2 (preview), P3 (send confirm sheet), P12 (both signed), P14 (withdraw sheet); P5 for the creator",
 "what_mockup_shows": "P3: sheet titled \"Send this agreement to Sneha?\", a \"What happens\" card, a grey note, then one row of two buttons in two exactly equal columns (CSS `.btnrow{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}`), both the same fixed height (`.btn.sm2{height:32px;font-size:12.5px;border-radius:9px}`), tops and bottoms level, labels on one line: \"Not yet\" = white with a 1.5 px black outline, \"Send\" = filled. P14 is the same row with \"Keep it\" | \"Withdraw\" (Withdraw white with red label and pale red outline). P12 is the same row with \"Download\" (outline, download icon) | \"Shoot plan\" (filled). P2 has one full-width \"Send for signature\" with a send icon in a bottom bar.",
 "live_matches_mockup": "partly",
 "difference": "Wording and order match (Not yet | Send, Keep it | Withdraw, Download | shoot button; Send for signature). Layout does not: live outline button is ~10 px lower and ~2 px taller than its neighbour; mockup is level and equal. Live outline is 1 px pale grey (#E5E4DE); mockup is 1.5 px black. Live Withdraw is solid red with white label; mockup is white with red label. Live buttons are ~48 px tall with 15 px labels; mockup sheet buttons are 32 px with 12.5 px labels. Live has none of the mockup's icons (send, pen, wallet, download). Live P12 right-hand label was deliberately lengthened on 20 Sep (\"Confirm the shoot is done\" etc.) and no longer fits the half-width button the mockup drew for \"Shoot plan\". Live also shows a full-width red Withdraw bar in the footer while waiting, which the board does not draw."
}

## CORRECTIONS
- Count is wrong: the finding says the outline button's top gap serves 'about 40 other stacked uses'. There are 98 <SecondaryButton> uses in Packages/Mobile/src (non-test); about 20 sit in side-by-side rows, so roughly 78 are stacked or standalone. PrimaryButton has 143 uses and DangerButton 22. The style is at Packages/Mobile/src/components/settings/primitives.js:250.
- Both-signed row, Store Visit: the finding measures it only against item 7 board P12 ('Download | Shoot plan'). The later locked item 10 board V1 (features/item10-store-visit/04-preview/mockups/item10-store-visit-locked.html:444) draws this state with ONE full-width 'Plan the visit' in the bottom bar and no Download beside it. P12 is only the right reference for Remote, where the label is the short 'Shoot plan' (copy7.js:119).
- The finding offers 'keep short labels' as a way to keep the both-signed row side by side. Shortening the labels would reverse the 20 Sep walk fix and break Packages/Mobile/src/components/shoot/__tests__/shoot10.test.js:111-117, which pins every C10.openLabel string exactly.
- The finding's own list contradicts its screen description: it lists shoot10.test.js under existing_tests but never says it blocks the short-label variant it proposes in Frame 4(b).
- Open question 1 misstates the colour rule. Packages/Mobile/src/theme/tokens.js:507-508 says 'Mono rule: yellow is only ever the ONE main button on a screen', and the locked item 7 and item 10 boards both use #FFC700 for the main button (mockup line 13, 93). Yellow main button is consistent between code and locked boards; it is not a conflict that needs a founder decision for this fix.
- Mockup difference not listed: board P3 draws the 'Nothing can be changed once it is sent...' text inside a grey box (mockup line 400, class greybox); live renders it as plain small grey text (sheets7.js:34, style s.hint at :194). Board P14 likewise draws the withdraw body in a grey box (line 414); live is plain text (sheets7.js:180).
- Minor: the brand screen shows Download whenever both have signed (BrandAgreementScreen.js:240, 257) and ignores the server's can.download flag that the tests set (item7Brand.test.js:115). Not a cause of the unevenness, but relevant if that row is redrawn.
- Everything else checked out against the code: primitives.js:245-255 (secondary has marginTop 10 + borderWidth 1; primary/dangerBtn have neither), sheets7.js:35-38 and 182-185, sheets7.js:198 and BrandAgreementScreen.js:330 (row style with no alignItems), BrandAgreementScreen.js:256-270 and 278-292, copy10.js:91-96, sheets.js:13-20/96-99/120, AgreementScreen.js:190-199 and 204-209, mockup lines 90-96, 218-219, 399, 400, 411, 414. React Native is 0.73.6, so the 'gap' style does apply. No uncommitted edits to these files.

## MISSED SITES
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\shared\PitchThreadScreen.js :: Lines 147-164 (row style 'pair' at :188): 'Counter back' (outline) beside 'Reject' / 'Decline' (red). Same 10 px drop. Shared screen, so it shows in BOTH the brand and creator apps. Not in the investigator's list.
- C:\WORK\inflx-platform\Packages\Mobile\src\components\settings\primitives.js :: Line 190 vs 254: DangerButton's busy spinner is coloured T.danger on a T.danger background, so it is invisible (red on red). Shows on the Withdraw sheet while the request runs (sheets7.js:184 passes busy).
- C:\WORK\inflx-platform\Packages\Mobile\src\components\agreement\sheets7.js :: Line 37: the Send button passes busy but no busyLabel, so while sending it reads 'Saving' (default at primitives.js:133). The sibling shoot-plan sheet passes busyLabel="Sending" (components/shoot/sheets10.js:30).
- C:\WORK\inflx-platform\Packages\Mobile\src\components\settings\primitives.js :: Lines 147-160: SecondaryButton accepts no 'disabled' prop and sets no accessibilityRole. components/remote/sheets11.js (lines 38, 91, 115, 134, 152, 177, 213) and screens/influencer/RemoteAddressScreen.js:238 pass disabled={busy}, which is silently dropped, so those 'Not yet' buttons stay tappable mid-request. Relevant because the fix reworks this component.
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\influencer\InvitationScreen.js :: Lines 148-154 (already listed by the investigator) have a second effect not noted: 'pair' has marginTop 8 (:190), so 'Counter' sits 18 px under Accept while 'Decline' sits 8 px under it. Same in ThreadScreen.js:101-107 (:120), BrandThreadScreen.js:109-120 (:135) and PitchThreadScreen.js. A shared row must replace the marginRight: 8 wrappers these four use, not only the gap-style rows.
- C:\WORK\inflx-platform\Packages\Mobile\src\components\shoot\sheets10.js :: Lines 30-31: the 'Send this plan?' sheet STACKS Send over Not yet, while its locked board V3 (item10 mockup line 446) draws them side by side. Not uneven today, but if the agreement sheet is fixed as a level pair this sibling 'Not yet | Send' sheet will look inconsistent beside it. Decide once for both.
- C:\WORK\inflx-platform\features\item7-agreement\06-diff\notes.md :: The item 7 sign-off recorded 'P3 Sending it: None' and 'P14 Withdrawing: None' differences, verified by render tests only ('No device was attached to this session'). That is why the crooked pair was never caught; a jest pass will not catch it this time either.

## FIX RISKS
- Blast radius of the shared file: primitives.js is imported by 115 files across the brand and creator apps (not the shopper app). The proposal to give all three buttons the same minimum height and border changes about 263 buttons (143 primary, 22 danger, 98 outline), not just the pairs. Safer: leave standalone geometry alone and equalise only inside the new row.
- Short-label variant breaks a test and a founder walk fix: shoot10.test.js:111-117 pins the C10.openLabel strings. Variant (b) in the finding's Frame 4 must not be built by editing copy10.js.
- Governance gates the finding does not mention: any change under Packages/Mobile/src needs a contract with all three mockup_locked fields, a non-empty 06-diff/notes.md, and maestro_green before release (CLAUDE.md gov-check Rules 3, 4, 5). It is production-impacting, so it needs the founder's explicit go.
- Two over-the-air publishes, not one: the shared button file ships in both the brand and creator bundles. Publish one at a time and verify each manifest.
- Jest will not prove the fix: no Mobile test asserts layout or uses snapshots, so the suite passes whether the pair is level or not. Keep every testID (send-not-yet, send-confirm, withdraw-keep, withdraw-confirm, download, shoot-plan, counter, decline, thread-counter, thread-decline, move-keep, move-decline, brand-counter-back, brand-decline, pitch-counter, pitch-reject, pitch-thread-counter, pitch-thread-decline, accept-not-now, accept-confirm, reject-keep, reject-confirm, wallet-add-money, wallet-withdraw, rename, delete) or item5/6/7/8, contentScreens and brandWallet tests break. The level pair needs a phone or screenshot check.
- Conditional halves: in InvitationScreen, ThreadScreen, BrandThreadScreen and PitchThreadScreen the outline button is sometimes absent and 'Decline' must then fill the full width. BrandPitchScreen.js:95-106 can render zero, one or two halves. BrandWalletScreen.js:64-68 swaps the right half between a disabled primary and an outline button. A shared row must handle one child, and an empty row must not leave a gap.
- Removing the outline button's top gap inside a row changes vertical spacing where two outline buttons are already level with each other (BrandSetDetailScreen.js:189-193 and 235-238, BrandGroupDetailScreen.js:94-98, PostShareScreen.js:56-59, PostStatusScreen.js:109-112): they move up 10 px. Either leave those out of this pass or re-check each one.
- The exported style object 'st' is used outside the file (NicheLanguagesScreen.js:11, 26-27 use st.chip). Do not rename or restructure existing keys.
- Option C recolour (black outline on every outline button, white-with-red Withdraw/Decline) is a recolour of 98 + 22 buttons across two apps. It needs the contrast audit the house rule requires and should be a separate decision, not bundled into an alignment fix.
- If SecondaryButton gains a working 'disabled' prop as part of the rework, eight existing callers that already pass disabled={busy} change behaviour at once (their 'Not yet' buttons become untappable mid-request). That is the intended behaviour, but it is new behaviour and should be stated.
- No backend contract, migration or native rebuild is involved: confirmed. All styles are plain React Native 0.73 and the vector-icons package is already installed.

## FIX FINAL
Keep the investigator's direction (option B: fix once in the shared button file, apply to every mixed pair in both apps), with these changes.

1. In Packages/Mobile/src/components/settings/primitives.js add a small ButtonRow (two equal halves, one gap, children stretched to one common height, labels centred on one line). Inside the row the outline button drops its built-in top gap, and every button fills the row height so the 2 px border difference disappears. Do NOT change the standalone size of the 263 existing buttons. ButtonRow must cope with one child (full width) and none.

2. Use it for every mixed pair:
   - components/agreement/sheets7.js:35-38 and 182-185
   - components/pitch/sheets8.js:42-45, 83-86, 99-102
   - screens/influencer/InvitationScreen.js:148-154
   - screens/influencer/ThreadScreen.js:101-107
   - screens/brand/BrandThreadScreen.js:109-120
   - screens/shared/PitchThreadScreen.js:147-164 (missed by the investigator)
   - screens/brand/BrandPitchScreen.js:95-106
   - screens/brand/BrandWalletScreen.js:60-68
   - screens/create/CollectionScreen.js:70-73
   Leave the rows of two outline buttons alone in this pass.

3. Brand agreement after both sign (BrandAgreementScreen.js:256-270): do not keep the side-by-side row. Follow the locked item 10 board V1: the state-telling shoot button goes full-width, with "Download" as a full-width outline button under it. The 20 Sep labels stay exactly as they are, so shoot10.test.js keeps passing.

4. Fold in two adjacent faults on the same sheets:
   - sheets7.js:37: pass busyLabel "Sending" so the button stops reading "Saving".
   - primitives.js:190: make the danger spinner white so it is visible on the red button.

5. Keep the yellow main button and the roughly 48 px button height. Leave the black-outline and white-with-red recolour (option C) out of this fix; raise it as its own decision with a contrast audit.

6. Keep every testID. Verify the level pair on a phone or screenshot, because jest cannot see it. Ship as over-the-air updates to brand and creator, one at a time, after the founder's go.

## DRAW FINAL
Draw at phone width 360, yellow main button with dark label (as the locked item 7 and item 10 boards and the code have it), buttons about 48 px tall. Keep all locked wording exactly.

Frame 1 - Brand, send sheet (the fix; board P3). Title "Send this agreement to Sneha?". Grey card "What happens": Sneha signs: First / You sign: After her / Both by: 17 Oct 2026. Note "Nothing can be changed once it is sent..." in a grey box as the board draws it. Then ONE row of two exactly equal halves, 8-10 px gap, same height, tops and bottoms level, labels centred on one line: left "Not yet" (outline), right "Send" (main). Add a small before/after inset showing today's 10 px drop and the 2 px height difference. Add a second small state: Send while busy, reading "Sending" with a spinner.

Frame 2 - Brand, withdraw sheet (board P14). Title "Withdraw this agreement?", body and hint, then the same level pair: "Keep it" | "Withdraw". Show the busy state with a visible spinner.

Frame 3 - Brand, after both have signed, Store Visit (board item 10 V1, not item 7 P12). Green "Signed by both" box, the three-tick gate card, the four-step line, the countdown. Then the state-telling button FULL-WIDTH on one line, with "Download" as a full-width outline button with the download icon beneath it. Draw it three times with the real labels to prove each fits: "Plan the visit", "Confirm the shoot is done" (with tick), "Waiting on her answer — open the visit". Add the longest one, "The visit time passed — send a new time", as a fourth small inset.

Frame 4 - Brand, after both have signed, Remote (board item 7 P12). Either the same stacked layout as Frame 3 with "Shoot plan" on top and "Download" beneath, or the board's level pair "Download" | "Shoot plan" (both labels are short, so the pair fits). Draw both for the founder to pick one.

Frame 5 - Creator, invitation footer (same rule in the other app). "Accept" full-width, then a level, equal pair "Counter" | "Decline". Add the variant where Counter is hidden and "Decline" fills the full width.

Frame 6 - Shared pitch conversation footer (the missed site). The accept line as a full-width button, then a level pair "Counter back" | "Reject" (brand) / "Decline" (creator).

Not to redraw: the preview screen with its single full-width "Send for signature" (already even), the brand sign sheet (single button), and the creator agreement screen (Sign and Decline stacked, already even).

## QUESTIONS
- Main button colour: on the agreement screens the main button is YELLOW with a dark label today, both in the code (theme/tokens.js:512) and on the locked item-7 board. The standing rule says black with a white label. Which should the redrawn screens use?
- After both sign, the right-hand button now carries long labels ("Confirm the shoot is done", "Waiting on her answer — open the visit"). Stack the two buttons full-width so the label fits, or go back to the board's short "Shoot plan" / "Plan the visit" side by side?
- The board draws the outline button with a black outline; live it is a very pale grey line. Switch every outline button in both apps to the black outline?
- Withdraw / Decline: the board shows white with red text; live is solid red. Which one?
- The board's sheet buttons are small (32 px). Keep the live, easier-to-tap height (about 48 px) and only make the pair level and equal?
- Fix every other uneven pair found (creator invitation Counter | Decline, negotiation threads, pitch sheets, wallet, collection) in this same pass?

## TESTS
- Packages/Mobile/src/screens/brand/__tests__/item7Brand.test.js
- Packages/Mobile/src/screens/influencer/__tests__/item7Creator.test.js
- Packages/Mobile/src/components/settings/__tests__/dangerButton.test.js
- Packages/Mobile/src/components/shoot/__tests__/shoot10.test.js
- Packages/Mobile/src/screens/brand/__tests__/item8Brand.test.js
- Packages/Mobile/src/screens/influencer/__tests__/item8Creator.test.js
- Packages/Mobile/src/screens/brand/__tests__/item6Brand.test.js
- Packages/Mobile/src/screens/influencer/__tests__/item6Creator.test.js
- Packages/Mobile/src/screens/influencer/__tests__/item5Creator.test.js
- Packages/Mobile/src/screens/brand/__tests__/brandWallet.test.js
