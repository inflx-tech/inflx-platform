# C05-creator-three-options — Creator collaboration: three option buttons uneven

## TODAY
Creator app, Collabs > Invites > tap a card > "Invitation" screen (C:\WORK\inflx-platform\Packages\Mobile\src\screens\influencer\InvitationScreen.js). Top to bottom: back arrow + title "Invitation"; brand logo, brand name, "campaign · set" line; a grey card "Set by the brand, same for everyone" (Aim, Posts on, Mode, Reply by); a bordered card "Your terms" (commission / fee / what she posts etc.); the brand's note in italics; a small grey centred line "Nothing is final until you both sign the agreement." Then a bar pinned to the bottom of the screen with the three choices:
1. "Accept" - full width, yellow fill, black bold label, about 48 high.
2. Under it a row of two half-width buttons:
   - left "Counter" - white, a faint pale-grey hairline border, black semi-bold label, no icon. It starts 18 below Accept (8 row gap + its own built-in 10) and is about 50 high.
   - right "Decline" - SOLID RED fill, white bold label, no border. It starts 8 below Accept and is about 48 high.
Result: Decline's top edge is 10 higher than Counter's, Decline's bottom edge is about 12 higher than Counter's, and the two are not the same height. Decline (solid red) is the loudest thing on the screen, louder than Accept. When the brand has countering switched off, Counter disappears, one grey line explains why, and Decline stretches to full width under Accept (this state is level, but Decline is still solid red). The last line of the page ("Nothing is final...") can sit partly hidden behind the pinned bar because the bar (about 153 high) is taller than the 140 of blank space left for it.
The same three-button bar, with the same tilt, appears on the creator's counter conversation screen ("Accept 11.5%" / "Counter back" / "Decline").

## ROOT CAUSE
One shared style, used the wrong way round.
- C:\WORK\inflx-platform\Packages\Mobile\src\components\settings\primitives.js line 250: the SecondaryButton style has `marginTop: 10` baked in (plus `borderWidth: 1, borderColor: T.border`). It was written for the stacked case (ConfirmSheet: main button, then "Cancel" underneath - components/settings/sheets.js lines 96-99).
- primitives.js line 254: the DangerButton style has NO top margin and NO border, and is a solid fill (`backgroundColor: T.danger`, white label).
- InvitationScreen.js lines 149-154 put a SecondaryButton (Counter) and a DangerButton (Decline) side by side in `pair: { flexDirection: 'row', marginTop: 8 }` (line 190). A row stretches both wrapper boxes to the same height, but each button keeps its own size inside its box and sits at the top of it. So Counter is pushed down by its own 10 margin and is 2 taller (its 1px border top+bottom), while Decline stays at the top. Net: tops differ by 10, bottoms by about 12.
- On top of the misalignment the three buttons do not share a visual family: Accept = yellow fill (tokens.js line 512 `primary: '#FFC700'`), Counter = pale-grey outline semi-bold (primitives.js 250-251), Decline = solid red bold (254-255). The locked board draws Counter and Decline as a matched pair of outline buttons.
- Label lengths are NOT the cause on the Invitation screen ("Accept", "Counter", "Decline" - copy5.js line 260 - all fit on one line at 360 wide; each half button is about 162 wide). On the counter-conversation screens the Accept label is built from the terms (copy6.js line 111 `Accept ${line}`, e.g. "Accept ₹12,000 · 1 reel, 2 stories, 1 YouTube video") and can wrap to two lines; the primary label has no centre alignment and the button has no side padding (primitives.js 245-247), so a wrapped label would run edge to edge and left-aligned - a second, rarer source of unevenness.
- Secondary effect: the pinned bar is about 1+14+48+8+60+22 = 153 high but the scroll area only reserves 140 (InvitationScreen.js line 78), so the closing hint can be clipped.

## MOCKUP
{
 "file": "C:\\WORK\\inflx-platform\\features\\item5-invitations\\04-preview\\mockups\\item5-invitations-locked.html",
 "screen_ref": "I12 (Creator · the invitation), I13 (Pay for Content invitation); same bar on item6 N7 / N10 / N17, and N6 / N19 for the two-button case",
 "what_mockup_shows": "Order and wording: \"Accept\" first, full width, the one filled main button (42 high). Directly under it, 8 apart, ONE row of two equal-width buttons, level with each other and the same height (32 high, slightly smaller text than Accept): left \"Counter\" - white with a dark outline and a small undo arrow before the word; right \"Decline\" - white with red text and a pale red outline. The line \"Nothing is final until you both sign the agreement.\" sits immediately above Accept. When the brand is not taking counters (N19): a grey line saying so, then Accept, then a full-width outline Decline stacked under it. The older atlas (atlas-creator.html SC-05) drew the same three as three stacked full-width buttons - also with an outline, not solid, decline.",
 "live_matches_mockup": "partly",
 "difference": "Matches: order (Accept, then Counter | Decline), wording, Counter hidden-not-greyed, equal widths. Does not match: (1) Counter sits 10 lower than Decline and is 2 taller - the board has them level and identical in height; (2) Decline is a solid red block with white text - the board has white with red text and a pale red outline; (3) Counter has a faint grey hairline - the board has a clear dark outline; (4) Counter has no undo icon - the board has one; (5) all three buttons are the same big size - the board makes the second row visibly smaller than Accept; (6) the 'Nothing is final...' line is at the end of the scrolling page and can be clipped by the pinned bar, instead of sitting right above Accept. Colour note: the item 5 board paints Accept yellow (as the live app does); the mono design rule says main buttons are black with white labels - these two disagree and need a founder call."
}

## CORRECTIONS
- Accept colour is not a real conflict. features/item2-pitch-invitation-settings/PROMPT.md:373 says 'Yellow is only for the one main button on a screen', Packages/Mobile/src/theme/tokens.js:507-512 repeats it (primary '#FFC700'), and the item 5, 6, 7 and 8 locked boards all use --primary:#FFC700 (item5-invitations-locked.html:13, 93). The 'black with white label' rule the finding quotes is the older 24 Aug mono note, which these later locked rules supersede on settings-token screens. Drop it as a blocking founder question.
- Board N5 is wrongly cited for the creator's three-button conversation bar. features/item6-negotiation/04-preview/mockups/item6-negotiation-locked.html:355 (N5 'Creator - waiting') has no buttons; :356 (N6 'the last round') has only 'Accept 11.5%' and a full-width outline 'Decline'. No locked board draws the creator's Accept / Counter back / Decline state that ThreadScreen.js:99-109 renders. The nearest is the brand board N7 (:357).
- The 'about 141' bar height quoted under option D is the height after the fix, not today's. Today the bar is about 153 (1 + 14 + 48 + 8 + 60 + 22), as the finding says elsewhere.
- The clipped 'Nothing is final...' line is understated. With the scroll area reserving 140 (InvitationScreen.js:78) against a bar of about 153, roughly 13 of the line's ~16 height is hidden at full scroll. In the counters-off state the bar is about 166, so the line is fully hidden. ThreadScreen.js:71 has the same hard-coded 140.
- BrandWalletScreen.js:61-70 is only tilted when no withdrawal is waiting. When one is waiting, both buttons are PrimaryButtons (line 66) and sit level.
- The locked boards do not draw a pinned bar at all. On I12 the hint, Accept and the pair sit in the page flow (item5-invitations-locked.html:322). Pinning the bar is an app choice, so moving the hint into the bar is a new design decision to lock, not a restoration of the board.
- The finding lists creatorTerms12, item7Creator, item8Brand, item8Creator and shoot10 under existing tests without showing they assert on these bars. No Mobile test asserts button style or position (the only style assertions are remote11.test.js:178 and SplashScreen.test.js:49). The tests that do pin this bar's testIDs are item5Creator.test.js:90-147, item6Creator.test.js:71-194 and item6Brand.test.js:82, 265.
- Layout numbers are derived from the code, not measured on a device. The 10 drop and 2 extra height are exact (primitives.js:250 marginTop 10 and borderWidth 1, against :254 with neither); the absolute heights of 48/50 depend on the font's line height.

## MISSED SITES
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\brand\BrandPitchScreen.js :: Lines 92-106 and 130: brand pitch detail has 'Accept terms' over a row of SecondaryButton 'Counter' and DangerButton 'Reject' (row is flexDirection row, gap 10). Same 10-point tilt and solid red. Locked board: features/item8-pitch/04-preview/mockups/item8-pitch-locked.html:422, which also draws 'Open her full profile' as an underlined text link where the code uses a full SecondaryButton (lines 108-112).
- C:\WORK\inflx-platform\Packages\Mobile\src\components\settings\primitives.js :: Line 190: DangerButton's busy spinner is coloured T.danger on a T.danger fill, so it is invisible today. Lines 191 and 255: the busy label is white. An outline variant must switch both, or 'Working' becomes white on white.
- C:\WORK\inflx-platform\Packages\Mobile\src\components\negotiation\sheets6.js :: Lines 159-160 (decline a counter) and 184-185 (move her to the pool) stack the two buttons. Boards N9 and N11 (item6-negotiation-locked.html:359, 362) draw them side by side as 'Keep | Decline' and 'Not now | Move her'. Not tilted, but off-board. Line 159 also passes '...' as the label instead of using busy.
- C:\WORK\inflx-platform\Packages\Mobile\src\components\invitations\sheets5.js :: Lines 38-39: the creator's decline sheet, opened from the Decline button in question, stacks a solid red 'Decline invitation' over 'Not yet' and uses the '...' label instead of busy. Any change to DangerButton's default look lands here.
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\brand\BrandSetDetailScreen.js :: Lines 190-192 and 236-237: two SecondaryButtons side by side. They are level only because both carry the built-in 10 gap. Same pattern at BrandGroupDetailScreen.js:95-97, PostShareScreen.js:57-58 and PostStatusScreen.js:110-111. Converting one of a pair, or removing the gap globally, shifts or tilts these.
- C:\WORK\inflx-platform\Packages\Mobile\src\screens\shared\ShootThreadScreen.js :: Line 119: pinned bar with gap 8, and line 104 puts a SecondaryButton in it, so it gets 18 above instead of 8, like ShootScreen. The same bar style (gap 8) is in BrandShootScreen.js:240, BrandContentScreen.js:267, BrandRemoteBookScreen.js:193, BrandRemoteScreen.js:335, BrandSaleLiveScreen.js:311, ContentScreen.js:380 and RemoteShootScreen.js:352; I did not check each for a stacked SecondaryButton.

## FIX RISKS
- Shared buttons are imported by 112 files. DangerButton has about 20 call sites (decline invitation, decline agreement, withdraw, reject pitch, delete post, take down, report, cancel courier booking). Changing st.dangerBtn, st.secondary or st.primary defaults restyles all of them. The outline Decline, dark-outline Counter and no-top-gap behaviour must be opt-in variants.
- An outline DangerButton needs its busy branch handled: label and spinner must both turn red (primitives.js:190-191, 255), or the busy state is white text on white. No test catches this, so it needs a contrast check.
- The 'inline' flag must be applied to both buttons of a same-kind pair or neither. The four Secondary+Secondary rows listed under missed sites are level today only because both carry the gap.
- The board's second-row buttons are 32 high (item5-invitations-locked.html:92). Building that literally gives tap targets well under the 44-48 an Android phone needs. Draw and lock them at 44 or more.
- Moving 'Nothing is final...' into the pinned bar, or allowing a two-line Accept label, makes the bar taller. The scroll padding is a hard-coded 140 in InvitationScreen.js:78 and ThreadScreen.js:71 and is already too small. Measure the bar's real height (onLayout) instead of picking a new number.
- Centring and side-padding the PrimaryButton label for long 'Accept ...' labels changes every PrimaryButton in both apps. In the icon and busy rows (primitives.js:131-139) the text also needs flexShrink, or a long label overflows instead of wrapping.
- If ConfirmSheet is switched to side by side to match board I14, it changes 15 uses on 13 screens. Four test files press confirm-primary / confirm-secondary (item4Brand, pitchSettings, invitationSettings, item3bCreator), so the testIDs must be kept. Longer confirm labels may not fit a half-width button. Leave ConfirmSheet stacked in this pass.
- Tests pin testIDs, not layout. A shared answer-bar component must pass through accept, counter, decline, answer-actions, counter-off, thread-accept, thread-counter, thread-decline, thread-actions, brand-accept, brand-counter-back, brand-decline, move-agree, move-keep, move-decline, pitch-thread-accept/-counter/-decline and pitch-accept/-counter/-reject. It must also keep Counter absent, not disabled, when not allowed (item5Creator.test.js:111, 147).
- BrandPitchScreen.js:95-106 renders the row even when neither Counter nor Reject is allowed, inside a body with gap 12. A shared bar must render nothing in that case.
- Governance: this touches Packages/Mobile/src, so the push is blocked without a contract carrying mockup_locked (+_by, +_at) and a non-empty 06-diff/notes.md. A mobile release also needs maestro_green: true (gov-check Rule 5) or a recorded override.
- Delivery: JS only, so no APK rebuild. The undo arrow ('undo-variant' from MaterialCommunityIcons) is already shipped and used in ShootScreen.js:155. It needs two over-the-air publishes, influencer and brand, run one at a time. The shopper app does not import these buttons.
- The founder's separate 'send agreement buttons uneven' issue has the same cause (sheets7.js:35-38). If both are fixed independently they will both edit primitives.js. Fix once, under one contract.
- The working tree has many unrelated modified files and a second window shares it. Stage by path only.
- No backend, contract or migration impact: the buttons only choose which existing call fires.

## FIX FINAL
Option B, tightened so nothing changes by accident.

1. In Packages/Mobile/src/components/settings/primitives.js, add opt-in pieces only; leave today's defaults untouched:
   - SecondaryButton: `inline` (no built-in top gap) and `strong` (1.5 ink outline). The `icon` prop already exists.
   - DangerButton: `outline` (white fill, red label, pale red outline), with the busy label and spinner red in that variant.
   - A small shared answer bar: main button full width, then a row of two equal, level, same-height buttons 8 apart. Each wrapper is flex 1 and the row stretches them. With only one second-row button it becomes a single full-width button under the main one. With none, it renders nothing. It passes testIDs through.
2. Use the answer bar on every Accept / middle / Decline bar:
   - InvitationScreen.js:143-156
   - ThreadScreen.js:99-109
   - BrandThreadScreen.js:106-122 (both bars)
   - PitchThreadScreen.js:139-166
   - BrandPitchScreen.js:92-106 (missed by the finding)
3. Use the inline pair on the side-by-side confirm rows:
   - sheets7.js:35-38 and 182-185 (this closes the send-agreement complaint)
   - sheets8.js:42-45, 83-86, 99-102
   - BrandAgreementScreen.js:256-270
   - BrandWalletScreen.js:61-69
   - CollectionScreen.js:70-73
4. Accept stays yellow with a black label. Do not raise this as a question.
5. Second-row buttons are at least 44 high, not the board's literal 32.
6. Put 'Nothing is final until you both sign the agreement.' at the top of the pinned bar on the Invitation screen. Set the scroll area's bottom space from the bar's measured height, replacing the fixed 140 in InvitationScreen.js:78 and ThreadScreen.js:71.
7. Centre and pad the long 'Accept {terms}' label inside the answer bar only, not in the global PrimaryButton style.
8. Leave alone in this pass:
   - the global SecondaryButton top gap (option C)
   - ConfirmSheet's stacked layout
   - the standalone solid red buttons inside decline / withdraw / delete sheets
   - the stacked-bar spacing on the shoot / content / remote screens
   Record them as follow-ups.
9. Add one jest test that the two second-row buttons carry no top margin and identical vertical padding and border, and that Counter is absent when not allowed.

Delivery: one contract with mockup lock and 06-diff notes, then an over-the-air publish to influencer and to brand, one at a time. No backend change, no migration, no APK rebuild.

## DRAW FINAL
Draw at 360 wide, white and black. Yellow is used only for the one main button; red only for the decline text and outline.

Board 1: Creator, Invitation, counter allowed (locked source I12, features/item5-invitations/04-preview/mockups/item5-invitations-locked.html:322).
- Body unchanged: 'Invitation' header; brand row; grey card 'Set by the brand, same for everyone' (Aim, Posts on, Mode, Reply by); 'Your terms' card; brand note in italics.
- Pinned bar, top to bottom:
  - small centred grey line 'Nothing is final until you both sign the agreement.'
  - 'Accept': full width, yellow fill, black bold label, about 48 high.
  - 8 below, one row of two equal-width buttons, 8 apart, tops and bottoms exactly level, both about 44 high.
    - Left 'Counter': white, clear dark outline, small undo arrow before the word, dark label.
    - Right 'Decline': white, red label, pale red outline.
- Beside it, a small 'today' thumbnail: Counter 10 lower than Decline, Decline solid red.

Board 2: same screen, Pay for Content terms (I13, :323). Fee, 'You post', 'Brand can reuse' and 'How the fee is paid', with the same bar.

Board 3: same screen, brand not taking counters (N19, item6-negotiation-locked.html:372). Grey line '{Brand} isn't taking counters on this campaign.', then 'Accept' full width, then 'Decline' full-width red outline 8 under it. No Counter button.

Board 4: Creator, counter conversation, her move with rounds left. This is a new board; no locked one exists.
- Bar: 'Accept 11.5%' / 'Counter back' | 'Decline', in the same shape as Board 1.
- Second frame with a long label, 'Accept ₹12,000 · 1 reel, 2 stories', staying centred with side padding and wrapping to two centred lines if needed.

Board 5: Creator, last round (N6, :356). 'Accept 11.5%' and a full-width outline 'Decline' only.

Board 6: Brand, your move (N7, :357) and a request to move (N10, :361).
- 'Accept 13%' / 'Counter back' | 'Decline'
- 'Agree · move her to the pool' / 'Keep 20 Oct' | 'Decline'

Board 7: Brand, pitch detail (features/item8-pitch/04-preview/mockups/item8-pitch-locked.html:422). 'Accept her terms' / 'Counter' | 'Reject', with 'Open her full profile' as a quiet underlined link beneath.

Board 8: the level pair on confirm sheets.
- Brand 'send the agreement' sheet (item 7 P3): 'Not yet' | 'Send'.
- Withdraw confirm: 'Keep it' | 'Withdraw', with Withdraw in red outline.

Board 9: busy state of the outline Decline. Red spinner and red 'Working' label on white, to prove it stays readable.

Wording to keep exactly: 'Accept', 'Counter', 'Decline', 'Counter back', 'Accept {terms}', 'Agree · move her to the pool', 'Keep {date}', 'Reject', 'Not yet', 'Send', 'Nothing is final until you both sign the agreement.'

## QUESTIONS
- No screenshot reached me. I have taken 'three options' to mean Accept / Counter / Decline on the creator's Invitation screen (and the same bar on her counter conversation). Is that the screen you meant?
- Layout: keep the item 5 board's arrangement (Accept full width, then Counter and Decline side by side, level) - or would you prefer three full-width buttons stacked, as the older atlas screen drew it?
- Decline is a solid red block in the app today; every locked board draws it as white with red text and a pale red outline. OK to switch to the outline look so Accept stays the loudest button?
- Accept colour: the app and the item 5 board show yellow with a black label; the mono rule says main buttons are black with a white label. Which one should the new screen be drawn and locked with? (This affects every main button on the settings-token screens, not just this one.)
- The board makes Counter and Decline a step smaller than Accept. Keep that size difference, or make all three the same height for easier tapping?
- Shall the same fix be applied in one pass to the brand-side bars and the side-by-side confirm sheets (send agreement, withdraw, pitch accept / reject), since they share the cause?

## TESTS
- Packages/Mobile/src/screens/influencer/__tests__/item5Creator.test.js
- Packages/Mobile/src/screens/influencer/__tests__/item6Creator.test.js
- Packages/Mobile/src/screens/influencer/__tests__/creatorTerms12.test.js
- Packages/Mobile/src/screens/influencer/__tests__/item7Creator.test.js
- Packages/Mobile/src/screens/brand/__tests__/item6Brand.test.js
- Packages/Mobile/src/screens/brand/__tests__/item8Brand.test.js
- Packages/Mobile/src/screens/influencer/__tests__/item8Creator.test.js
- Packages/Mobile/src/components/settings/__tests__/dangerButton.test.js
- Packages/Mobile/src/components/shoot/__tests__/shoot10.test.js
