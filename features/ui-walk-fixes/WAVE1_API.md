# ui-walk-fixes — wave 1: the shared pieces and how to use them

Written by the wave 1 builders (after review and fixes). Use these; do not rebuild them.


---

## S0a — Shared building blocks

ALL PIECES ARE OPT-IN. Nothing below changes a screen until that screen uses it. (Changes since the first report are marked CHANGED.)

=== 1. Buttons — import { PrimaryButton, SecondaryButton, DangerButton, ButtonRow, AnswerBar, AnswerNote, ButtonSlot, buttonsOf } from '<rel>/components/settings/primitives' ===

SecondaryButton({ label, onPress, icon, testID, inline, strong, disabled })
  inline   boolean — drops the built-in marginTop 10 (use when it sits BESIDE a button outside a ButtonRow, or alone in a Sheet `footer`).
  strong   boolean — the boards' .b-sec: 1.5 ink outline (same height as the pale one).
  disabled boolean — NOW WORKS (press blocked, opacity 0.6). Also now accessibilityRole="button".
DangerButton({ label, onPress, disabled, busy, busyLabel, testID, outline })
  outline  boolean — the boards' .b-dan: white fill, red label, pale red outline (T.dangerLine). Same height as solid. busy is readable in both looks.
PrimaryButton — props unchanged.
Token: settingsTokens.dangerLine ('#F2B8B8').

ButtonRow({ children, style, testID })
  Two equal halves, 8 apart, one common height >= 44, labels on one line. Pass the buttons STRAIGHT IN as children with their own testIDs — do NOT wrap them in <View style={{flex:1}}> and do NOT pass `inline` (the row removes the top gap itself). null/false children are absent. 1 child = one full-width 44-min button. 0 children = renders null (no gap). `style` is for the row's own spacing (e.g. { marginTop: 4 }).
  CHANGED: fragments are opened at any depth and are safe in any position — a button beside a fragment (`<A/>{cond ? <><B/></> : null}`) gives two properly keyed halves, no React key warning.
  A child that is your own component which itself returns null still counts as a child — make the condition at the call site.
  Example (send sheet, E9):
    <ButtonRow style={{ marginTop: 4 }}>
      <SecondaryButton strong label={S.notYet} onPress={onClose} testID="send-not-yet" />
      <PrimaryButton label={S.send} onPress={onSend} busy={busy} busyLabel="Sending" testID="send-confirm" />
    </ButtonRow>
  Example (withdraw sheet, E10): <ButtonRow><SecondaryButton strong label="Keep it" … testID="withdraw-keep" /><DangerButton outline label="Withdraw" busy={busy} … testID="withdraw-confirm" /></ButtonRow>

AnswerBar({ note, main, children, style, testID })
  note      string | element | array of either (falsy entries dropped). Strings become the small centred grey line. To keep a testID on a line pass <AnswerNote text="…" testID="counter-off" />.
  main      the main button element, e.g. <PrimaryButton label={…} testID="accept" />. ONLY here a long label is centred, gets 16 side padding and may wrap to 2 centred lines.
  children  0–2 buttons → rendered as a ButtonRow under main (1 = full width; 0 = row omitted).
  Everything is 8 apart (gap). Renders null when there is no main and no child. CHANGED: a fragment that holds only null/false counts as nothing, for `main` and for the children alike. It has NO padding/border/background of its own — put it inside <BottomBar> for a pinned bar, or straight in the page (E7). `testID`/`style` go on its container (use the existing bar ids: answer-actions, thread-actions …).
  Example (Invitation, E1/E2):
    <BottomBar>
      <AnswerBar testID="answer-actions"
        note={[D.final, inv.counterHiddenReason === 'switch_off' ? <AnswerNote key="off" text={C6.invitation.counterOff(inv.brand.name)} testID="counter-off" /> : null]}
        main={<PrimaryButton label={D.accept} onPress={() => setSheet('accept')} testID="accept" />}>
        {inv.canCounter || inv.canMoveRequest ? <SecondaryButton strong icon="undo-variant" label={D.counter} onPress={() => setSheet('choice')} testID="counter" /> : null}
        <DangerButton outline label={D.decline} onPress={() => setSheet('decline')} testID="decline" />
      </AnswerBar>
    </BottomBar>
  Example (E11/E12, state button full width, Download full width under it at 44):
    <BottomBar><AnswerBar main={<PrimaryButton icon="check" label={openLabel} … testID="shoot-plan" />}><SecondaryButton strong icon="download" label="Download" … testID="download" /></AnswerBar></BottomBar>

ButtonSlot — React context, default null. Values 'row' (set by ButtonRow), 'main' (AnswerBar's main), 'stack' (BottomBar). You normally never touch it.
  CHANGED: the slot reaches EVERYTHING drawn beneath a bar, however deep. `Sheet` now sets it back to null, so a pop-up opened by a component that lives in a bar has plain buttons. If you draw your own raw RN <Modal> (not Sheet) from inside a ButtonRow / AnswerBar / BottomBar, wrap its content in <ButtonSlot.Provider value={null}>…</ButtonSlot.Provider> — or better, render the pop-up as a sibling of the bar, not inside it.

buttonsOf(children) — NEW export. Returns the flat list of children that are really there (null/false dropped, fragments opened at any depth). Use it if a screen needs "is there anything to draw?" before wrapping a bar.

=== 2. Sheet — import { Sheet } from '<rel>/components/settings/sheets' ===
Sheet({ visible, onClose, children, testID, fit, footer })
  (no fit, `footer` not passed at all)  → exactly today's sheet.
  fit                  → sheet can shrink to the room between status bar and keypad; children are put in a ScrollView body (keyboardShouldPersistTaps="handled"). Do NOT put a FlatList in it.
  fit="list"           → same, but the body is a plain shrinking View (no ScrollView) for a sheet whose content is a FlatList. Leave the FlatList as a direct child (a `style={{ maxHeight: N }}` may stay); things above it keep their height.
  footer               → element pinned at the bottom of the sheet, outside the scroll; it already has paddingTop 12, so REMOVE your own spacer / marginTop above the buttons (a lone SecondaryButton in a footer: pass `inline`). A hairline shows above it only while the body is actually scrolling.
  CHANGED — WHICH SHAPE: the fit shape is taken when `fit` is on OR when the `footer` prop is given at all, EVEN AS null / false. So `footer={ready ? <Send/> : null}` and `footer={ready && <Send/>}` are fit sheets from the first draw and the button may come and go without the pop-up being rebuilt (typed text, cursor and keypad survive). Once a mounted sheet has the fit shape (scroll or list) it keeps it whatever is passed later. The ONE thing that still rebuilds the pop-up is an old-shape sheet that is later handed `fit` — so write `fit` (or `footer`) unconditionally on the sheet; never `fit={someState}`. `footer={undefined}` / leaving it out + no `fit` = the old sheet.
  CHANGED: buttons inside any Sheet are "on their own" (slot reset to null) even when the Sheet is rendered from inside a ButtonRow / AnswerBar / BottomBar. A ButtonRow placed inside the sheet works normally.
  Sheet padding is unchanged (18, bottom 28). Parts carry testIDs `${testID}-body` and `${testID}-footer` ('sheet-body' / 'sheet-footer' when the sheet has no testID).
  Example (counter sheet, C6):
    <Sheet visible={visible} onClose={onClose} testID="counter-sheet" fit
      footer={<PrimaryButton icon="send" label={S.send} onPress={submit} busy={busy} busyLabel="Sending" testID="counter-send" />}>
      …round tag, fields, note box, counter…
    </Sheet>
  Example (two buttons pinned, C7): footer={<ButtonRow><SecondaryButton strong label="Back" … /><PrimaryButton label="Send" … /></ButtonRow>}
  Example (picker): <Sheet … fit="list" footer={<PrimaryButton label={apply} testID="picker-apply" />}><TextInput …/><FlatList … /></Sheet>

=== 3. BottomBar — import { BottomBar } from '<rel>/components/shell/BottomBar' (also the default export) ===
BottomBar({ children, hint, hintTestID, style, testID })
  In-flow strip: borderTop 1, padding 14, paddingBottom 14 + bottom safe-area inset, white, children 8 apart. Put it as the LAST child of the screen's flex:1 column, after a ScrollView that has style flex:1 — then delete the old `position:'absolute'` bar style AND the ScrollView's paddingBottom 120/140/190 that made room for it.
  A SecondaryButton stacked in it loses its top gap automatically (do not pass `inline`).
  hint  string → small centred grey line under the buttons (testID via hintTestID); or pass your own element.
  A line above the button ("Fix 1 thing above to save") = pass it as the first child.
  Renders null with no child and no hint. CHANGED: a fragment holding only null/false (`<>{a ? <X/> : null}{b ? <Y/> : null}</>` with both off) now also counts as no child — no empty strip. Still true: a child COMPONENT that itself renders null (e.g. an AnswerBar with nothing in it) cannot be seen from outside and leaves an empty strip — make that condition around <BottomBar>.
  Do not put it inside a SafeAreaView that already pads the bottom (the inset would be added twice).
  Example: <View style={base.screen}><Header …/><ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18 }}>…</ScrollView><BottomBar testID="content-actions" hint={line} hintTestID="posted-hint"><PrimaryButton label={C.posted} disabled={!can} onPress={markPosted} testID="mark-posted" /></BottomBar></View>

=== 4. useKeyboardVisible — import { useKeyboardVisible } from '<rel>/hooks/useKeyboardVisible' (also the default export) ===
  const typing = useKeyboardVisible();   // true while the keypad is showing
  Call it ABOVE every early return (hooksBeforeReturns.test.js). Use it only to change WHAT is drawn while typing (e.g. `{typing ? null : <BottomBar>…</BottomBar>}` for the picker footer). It is not needed to keep a field visible — BottomBar and a fit Sheet do that by layout. Do not make a Sheet's layout or its `fit` prop depend on it.

=== Test habit worth copying ===
The slice's test files spy on console.error in beforeEach and assert it stayed silent in afterEach. React reports a clash of keys (and similar tree mistakes) only there; without the guard such a test passes while the screen misbehaves.


---

## S0b — No blank strip · tabs on the five main pages

ALL PATHS under C:\WORK\inflx-platform\Packages\Mobile\src

1) TOP INSET — hooks/useTopInset.js (unchanged this round)
   import useTopInset, { TOP_GAP, TOP_GAP_TITLE, topInsetOf, TopInsetProvider, START_METRICS } from '../../hooks/useTopInset';
   - useTopInset(gap = TOP_GAP) -> number = phone's top inset + gap. TOP_GAP = 4 (a bar with a 40-high control), TOP_GAP_TITLE = 8 (a bare title on a main page).
   - It is a HOOK: call it above every early return (hooksBeforeReturns.test.js scans for it).
   - Example for a screen that draws its own top row:
       const top = useTopInset(TOP_GAP_TITLE);
       <View style={[s.titleRow, { paddingTop: top }]}>...
   - A screen that uses the shared Header must NOT add top padding of its own: Header does it.
   - In jest, jest.setup.js returns zero insets (useTopInset() = 4, useTopInset(TOP_GAP_TITLE) = 8). To test another inset, mock 'react-native-safe-area-context' useSafeAreaInsets in that test file (see hooks/__tests__/topBandOnMainPages.test.js).
   - TopInsetProvider already wraps both tab navigators; do not add another SafeAreaProvider.
   - Guards: hooks/__tests__/useTopInset.test.js fails if any file in screens/brand, screens/influencer, screens/shared, screens/create, screens/wallet, components/shell or components/brand contains `paddingTop: 50..56`. hooks/__tests__/topBandOnMainPages.test.js renders each main page (loading / loaded / failed) and expects inset + 8 above the title; if you change a main page's title text, loaded-state testID or the API calls it makes on mount, update its row in PAGES there.

2) SHARED HEADER — screens/brand/BrandPitchSettingsScreen.js (unchanged this round)
   import { Header } from './BrandPitchSettingsScreen';   // or '../brand/BrandPitchSettingsScreen'
   Props: title, onBack, right (as before) + subtitle (optional string) + subtitleTestID (optional string, default 'header-subtitle').
   - subtitle is ONE Text node with the string exactly as passed (caps come from the style). One line, ellipsis. Falsy subtitle -> the old single-title bar.
   - Example for Add creators (keeps the existing testID):
       <Header title={P.title} subtitle={campaignName || setName ? P.sub(campaignName || '', setName || '') : undefined} subtitleTestID="pick-subline" onBack={() => navigation.goBack()} />
   - Style keys on the exported `s`: header (paddingTop 4), headerTitle, headerTitles, headerTitleStacked, headerSubtitle.

3) TAB BAR — navigation/BrandNavigator.js (the creator app imports from it; exports unchanged this round)
   export const TAB_BAR_STYLE   // { backgroundColor, borderTopColor, borderTopWidth: 1, height: 62, paddingBottom: 8, paddingTop: 6 }
   export const TAB_BAR_HIDDEN  // { display: 'none' }
   export const tabScreenOptions = ({ route }) => ({ headerShown: false, ..., tabBarStyle: TAB_BAR_STYLE, tabBarHideOnKeyboard: true, ... })
   export function isTabRoot(route, rootName, navigation) -> boolean
   export const tabRootOptions = (title, rootName) => ({ route, navigation }) => ({ title, tabBarStyle })
   export const BRAND_TAB_ROOTS = { HomeTab: null, CampaignsTab: 'BrandCampaigns', CreatorsTab: 'BrandCreators', WalletTab: 'BrandWallet', ProfileTab: 'BrandProfile' }
   navigation/InfluencerNavigator.js: export const CREATOR_TAB_ROOTS = { HomeTab: null, CollabsTab: 'Collabs', CreateTab: 'CreateHome', WalletTab: 'CreatorWallet', ProfileTab: 'ProfileMain' }

   RULES A LATER SLICE MUST KEEP (each has a test that turns red):
   a) Adding a screen to a stack needs nothing for the tabs: every screen other than the stack's first hides the bar. The first Stack.Screen of each stack must stay the main page.
   b) EVERY pushed screen must draw a way back in EVERY state (loading, failed, empty, blocked, loaded): the shared Header with onBack, e.g.
        if (status === 'loading') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
      A line of the shape `if (status === 'loading') return <View ...><Skeleton` in a pushed screen fails navigation/__tests__/pushedScreensHaveBack.test.js.
   c) A jump from one tab into an INNER screen of another tab must pass `initial: false` beside `screen`, on the same line:
        navigation.navigate('CampaignsTab', { screen: 'BrandSetDetail', params: { campaignId, setId }, initial: false });
      It puts that tab's main page underneath when the tab was never opened (no tabs on the inner screen, Back reaches the main page); it does nothing when the tab is already open. navigation/__tests__/tabBarRealNavigator.test.js pins the list of files that make such jumps — a new one must be added to that list, and a test that pins the navigate call must expect `initial: false`. The only jump that must NOT pass it is one into a tab that is locked for the account (the pending Home's Find brands card).
   d) A list that is drawn BOTH as a segment inside a main page and as a pushed screen (MyPitchesScreen, BrandPitchesScreen) draws its Header only when it receives a `route` prop. Keep embedding them with `navigation` only: <MyPitchesScreen navigation={navigation} />.
   e) On every pushed screen the bottom of the screen is the screen's own: a pinned button strip is the last thing drawn, no 62-point bar under it. Do not set tabBarStyle from a screen.
   f) The bar also leaves while the keypad is open on the five main pages (shared option). Hiding a screen's own footer while typing is NOT done here.
   g) Do not put a literal `<Tab.Screen name="…"` or `<XStack.Screen name="…"` in a comment in the navigator files: duplicateScreens.test.js and pushedScreensHaveBack.test.js read the source.

4) PITCH SCREENS (for the slices that own them — D: PitchFormScreen; E: BrandPitchScreen, PitchThreadScreen)
   - PitchFormScreen now starts every state with `{bar}` = <Header title={name} onBack={() => navigation.goBack()} />, where name is the brand's name. The in-body heading <Text testID="pitch-form-title">{C8.form.title(name)}</Text> is untouched. If slice D wants the bar to read "Pitch {brand}" exactly as frame D8 draws, pass C8.form.title(name) to the bar and decide what happens to the in-body heading (it would then repeat the bar).
   - BrandPitchScreen: <Header title={p.creator.name} …/> above the ScrollView; the body (name testID "pitch-creator-name", the buttons row) is untouched. getByText(creator name) now finds two nodes — use the testID.
   - MyPitchScreen: <Header title={p.brand.name} …/>; getByText(brand name) finds two nodes.

5) TESTING AGAINST THE REAL NAVIGATORS
   navigation/__tests__/tabBarRealNavigator.test.js shows how: jest.mock the two PNGs in @react-navigation/elements/lib/commonjs/assets, a safe-area mock that also exports SafeAreaInsetsContext, SafeAreaFrameContext and useSafeAreaFrame, jest.doMock every '../screens/…' the navigator imports, then mount <NavigationContainer ref={ref}><Navigator /></NavigationContainer> and drive it with ref.navigate / ref.goBack. Do not call jest.resetModules() in such a file (it gives the navigation packages a second copy of React).
