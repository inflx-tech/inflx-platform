# 05 — Impact

**Verdict: additive. No backend, no migration, no API, no money path. Three
profile screens gain one row each; everything else is new files.**

## Blast radius

| Area | Impact |
|---|---|
| `backend/**`, migrations, API | **None.** Not a file touched. |
| Money, wallet, escrow, commission | **None.** |
| Auth / RBAC | **None.** The Legal screens read bundled static content and make no network call, so they work signed-out and offline. |
| Existing mobile screens | Three profile screens gain one row. No existing row, handler or style was changed, except the brand screen's previous last row losing its `linkRowLast` border style. |
| Navigation | Two routes added per navigator, each name once. No existing route touched. |
| brand-web | Unchanged behaviour. `distribution.js` already existed and is now also read by the sync script. |
| Bundle size | About +90 KB of text per app. Accepted deliberately: it is the artefact the app stores require, and bundling it means Legal works offline and signed-out. |
| Dependencies | **None added.** |

## Risks and how each is handled

1. **Duplicate route name → hard crash on tab mount.** The known
   native-stack failure mode in this repo. Each name is registered once per
   navigator and verified by grep. The follower `ProfileStack` deliberately
   does not spread `SHARED_SCREENS`, so there is no hidden second
   registration to collide with.

2. **The generated copy goes stale.** Generating a file is only safer than
   copying one if drift is detected, so `pnpm qa` runs the generator in
   `--check` mode and fails the suite with the fix command. Without this, the
   website could show a corrected policy while three apps served the old text
   and nobody would know until it mattered.

3. **A document promises a feature the app does not have.** Handled upstream,
   before the web publish, by checking the code rather than assuming:
   `cancelOrder` exists, so that instruction stands; Return / report-a-problem,
   ticket numbers and in-app account deletion do not exist, and every sentence
   claiming them was softened to email, phone and web routes.

4. **Wrong documents shown to the wrong role.** This failure would be quiet —
   nothing crashes, a shopper simply sees paperwork that is not theirs. Guarded
   by explicit per-audience leak assertions, and mutation-checked by adding the
   Creator Agreement to the shopper set, which failed two tests as intended.

5. **Text too small or tables unreadable on a phone.** Tables render as
   stacked label/value cards rather than scrolling sideways, because a legal
   document that is annoying to read does not get read.

## Known gaps, recorded rather than hidden

- **The agency flavour has no Legal entry.** It shares the codebase but was
  not in the founder's list. One row and one registration when wanted.
- **No on-device verification.** No emulator or device was attached, so
  Maestro did not run and `release.released` stays `false` per Rule 5.

## Release classification

**Production-impacting via OTA only.** JS-only, so `pnpm publish-ota:all`
reaches users on next launch. No native change, so **no APK rebuild is
required**. No backend, no migration, no Vercel deploy.
