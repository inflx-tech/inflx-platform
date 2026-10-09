# item19-home — what was built against the locked board (v3)

Board: `04-preview/mockups/item19-home-v3.html` (BH1–BH6, CH1–CH5), locked 9 Oct 2026.
Rules: master v1.32 §24. No database change. No money path touched.

## What matches the board
- **Four sections, one order, on both apps** (H1): Needs you · Waiting on others · Money ·
  Campaigns (brand) / Running now (creator). Three rows at most in each; the heading and "See all"
  open the rest (H2).
- **Needs you rows**: who (avatar / logo / an icon), one sentence, the campaign and set, a "why now"
  where there is one, a Delayed tag, and one button in the set screen's own word.
- **Waiting on others**: compact rows with a tag on Home; the full list split Creators · INFLX
  (brand) / Brands · INFLX · Pitches (creator), a segment only for a group that has rows.
- **Money**: the Wallet's three lines in the Wallet's words; the heading opens the Wallet, a line its
  own list.
- **Campaigns / Running now**, the creator's store link with Copy, the quiet state (one green line),
  the first-day state (the only yellow button on Home), the bell with its count, the brand's
  Notifications list, the count on the Home tab.
- **The app opens on Home** for an approved account (H3). An account under review sees exactly the
  screen it saw before.

## Differences from the board, and why
| # | Board | Built | Why |
|---|---|---|---|
| 1 | The count rows read "3 new pitches" | "3 new pitches", or "3 pitches are waiting for you" when any is a reply to the brand's counter | one row covers both kinds of pitch that wait on the brand |
| 2 | "Add your bank account" was described as "Available above zero and no bank account" | shown only when the brand has **sales** and no bank account | a brand that has only loaded its wallet to fund collaborations would have been nagged for ever; the creator's "Add payment details" is unchanged (her Available is always money she can take out) |
| 3 | Brand row "Send a new time" with the button Open | the button is **Plan the visit** | the set screen's own word for that row; a Home row and the screen behind it must read the same |
| 4 | Creator "Mark the visit done" | listed from the day of the agreed visit | the rule lets her mark from the moment the time is agreed; listing it days early is noise |
| 5 | — | **Back returns to Home** after a row is opened | every row opens a screen inside another tab's stack; left alone, Back would land on that tab's main page and a person working down the list would have to find Home again each time. Proved on the real navigators, both apps |
| 6 | — | a collaboration can give two rows (review the content *and* confirm the return) | they are two things owed; no single row is ever in both lists |
| 7 | Phones on the board show a row's context on one line | long campaign and set names wrap to two | nothing is cut off |

## Found and fixed on the way (all inside this item's own files)
- "Send the products back" was counted and reminded but **no card opened it** once the shoot was
  marked. The Home row is that door.
- **Delayed** was stored on a collaboration and delivered to no list. It reaches both Home lists now.
  The set screen and the Collabs cards are not changed (they still do not say it).
- **Sign / Send agreement after the cutoff**: the set row can still offer them when another creator
  in the set has signed; the server then refuses the signature. Home tests the cutoff and offers
  neither.
- Eight kinds of creator notice (her content, shoot, Remote shoot, pitch, a negotiation thread,
  wallet ×2, Collabs) did nothing when tapped. They open their screens.
- A pending creator's notice count is never asked for (the read would have raised the "not
  approved yet" sheet from the background).

## Left as it is, on purpose
- `components/shell/ComingSoonScreen.js` is no longer shown anywhere (Home was its last user). The
  file and the four older tests that mount it directly are left for a separate clean-up.
- The two older server counts (`/brands/me/inbox-summary` → `needs_you`, `/influencers/me/needs-you`)
  are untouched and still unused by the phone. They are known to be wrong (survey, `00-survey/`).
- Opening a screen from a tapped **push** notification (the app closed): not in this item. The
  in-app lists route correctly.
- The brand website's home page is untouched.

## One rule, two places — how it is held together
`backend/tests/item19-home.test.js` seeds a collaboration at every stage through the real API,
records the server's verdict for each side, and writes
`Packages/Mobile/src/screens/__tests__/fixtures/home19-rows.json` (52 records). The phone's
`home19.test.js` puts every one through `setRowStep` / `cardStep`: a row in Needs you must carry a
button there and Home's word for it must be that button's word; a row in Waiting must not. Run
without `WRITE_HOME19_FIXTURE=1`, the backend test fails if its verdicts no longer match the file
the phone was tested on.

## Assertion drift (older tests moved to the locked decisions, never weakened)
| Test | Was | Now | Rule |
|---|---|---|---|
| `navigation/__tests__/tabBarRealNavigator.test.js` | opens on Creators / Collabs; Home one plain screen | opens on Home; Home is a stack; + Home jumps and "Back returns to Home" | H3, the Home stack |
| `navigation/__tests__/tabBarOnMainPages.test.js` | `HomeTab: null`; five `tabRootOptions` | `HomeTab: 'BrandHome' / 'CreatorHome'`; four + `homeTabOptions` (which spreads the same rule) | the Home stack, H6 |
| `navigation/__tests__/pushedScreensHaveBack.test.js` | 4 stacks; traced `../screens/` only | 5 stacks; also traces `../components/shell/` (Home's main page lives there) | the Home stack |
| `hooks/__tests__/topBandOnMainPages.test.js` | approved → "coming soon" placeholder | approved → Home, same space above its title | §24: Home is real |
| `screens/__tests__/registrationProfile.test.js` | approved → "Home is coming soon" | approved → Home | §24 |
