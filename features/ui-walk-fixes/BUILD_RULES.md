# ui-walk-fixes — rules for whoever builds a slice

Read this whole file before touching code. It is the same for every slice.

## What you are building to
- **The locked board**: `features/ui-walk-fixes/04-preview/mockups/ui-walk-fixes-mockups-v1.html`
  (source parts in `04-preview/src/NN-*.html`, one per board; read the part for your slice — the
  frames tagged AFTER / NEW are the acceptance target, the TODAY frames are what you are fixing).
  Locked by the founder on 2 Oct 2026. Layout, wording and behaviour in a frame's caption are binding.
- **The contract**: `01-spec.md` (decisions U1–U16 and D1–D6 are binding), `02-workflow.md`,
  `03-expected-outputs.md` (the checks your slice must make true), `05-impact.md`.
- **The research** for your slice: `research/C0N-*.md` — verified findings with file:line evidence.
  "FIX FINAL", "FIX RISKS" and "MISSED SITES" tell you where the traps are. Line numbers may have
  moved; re-read the code, never trust a number.

## Hard rules
1. **U10 — a frame is not a licence to delete.** Anything on a live screen that the frame's caption
   does not say changes, stays exactly as it is (switches, counters, hint lines, titles, steps the
   older boards never drew). Change only what the board says changes.
2. **Shared pieces are changed additively.** `components/settings/primitives.js` (≈260 call sites),
   `components/settings/sheets.js` `Sheet` (18 files), `components/discovery/DiscoverList.js`
   exported styles (the creator app's Find brands imports them), `components/invitations/bits5.js`
   `Chip5` (7 callers), `components/DateField.js` (6 callers), `components/shoot/bits10.js`
   (15 importers): add an opt-in prop or a new component; never change what an existing caller
   gets by default unless the board says that caller changes.
3. **Keep every `testID`.** Tests and Maestro flows press them.
4. **No fake green.** Never `.skip`, delete, or weaken a test to make it pass. When the locked board
   changes a behaviour a test pinned, REWRITE the assertion to the new behaviour and record it in
   `features/ui-walk-fixes/06-diff/drift/<slice>.md` (one line each: test file · test name · what it
   asserted · what it asserts now · which frame/decision). Add tests for every new behaviour.
5. **The three crash classes that have shipped from this codebase** — check each before you finish:
   a name used without being imported; a hook placed after an early `return`; an
   `accessibilityState` value that is not an explicit boolean. `src/utils/__tests__/importsResolve.test.js`,
   `src/__tests__/hooksBeforeReturns.test.js` and `src/__tests__/accessibilityStateBooleans.test.js`
   guard them; they must pass. Never register a second `Stack.Screen` with an existing name.
6. **Colours and type** come from `settingsTokens` in `src/theme/tokens.js` (import as `T`). The one
   main button on a screen is yellow (`PrimaryButton`). Row-level actions are never yellow. Status
   tones: `T.state.yourMove` amber, `.waiting` blue, `.active` green, `.completed` purple.
7. **No new native package.** The apps update over the air (JS only). Installed and usable:
   react-native-video 6.4.5 (must be required lazily behind a runtime check — see
   `components/shop/ShopVideo.js`), react-native-vector-icons (MaterialCommunityIcons),
   react-native-safe-area-context, @react-navigation/bottom-tabs 6.x, @react-native-clipboard.
   Android only — there is no iOS project.
8. **Copy lives in the copy files** (`components/*/copy*.js`), never as a string in a screen. Server
   sentences that mirror a phone copy file stay identical on both sides (e.g. `agreementCopy.js` ↔
   `agreement/copy7.js`; `content12.test.js` fails if `MSG12` gains a key the server lacks — new
   phone-only sentences go in `C12` / `C14`).
9. **Files.** Edit with the Edit tool. Never rewrite a source file through PowerShell
   `Get-Content`/`Set-Content` (it mangles — and ⚠). Other builders are editing other files at the
   same time, and sometimes other parts of a shared file (copy files, `bits5.js`, test files):
   **re-read a file immediately before each Edit**, change only your own region, and never
   reformat or reorder code you are not changing.
10. **Git: read-only.** No `git add`, `commit`, `stash`, `checkout`, `restore`, `reset`. A second
    window shares this working tree. Do not publish OTA, do not push, do not start dev servers, do
    not call production. Do not touch `APKs/`, `android/`, `.env*`.
11. **Tests.** Phone: `cd Packages/Mobile && npx jest <files>` — the whole suite takes about 10
    seconds (`npx jest --silent`), was 840/840 green before this build, and must be green when you
    finish, apart from failures caused by another slice's half-finished work in files you do not
    own (name them, do not fix them). Server: `cd backend && npx jest tests/<file> --runInBand`
    needs the local test database on port 5544; if it is not reachable, do NOT start, stop or
    re-initialise any database — write the tests, say "server tests written, not run", and move on.
12. **Scope.** Stay inside your slice's file list. If the right fix needs a file outside it, make
    the smallest edit, and say so in your report. If the board and the code disagree in a way the
    spec does not settle, do the conservative thing (U10) and report it — do not invent a design.

## Your report
Files changed (with one line each on what changed) · tests run and their results (exact counts) ·
drift recorded · anything on the board you could not build exactly, and why · anything you could not
verify without a phone · follow-ups you noticed but left alone.
