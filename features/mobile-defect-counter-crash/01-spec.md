# Defect — countering a brand request crashes the creator app

**Contract:** `features/mobile-defect-counter-crash/`
**Found:** 2026-08-26, by the founder, on a handset.
**Live since:** 2026-08-24, commit `7af6997` *"Item 7: counter where the number is"*.

---

## 1. What a creator saw

Creator app → **Collabs → Invitations** → open a brand's request → tap **counter**.
**The app closed.**

Not an error message. A crash. And countering is one of the three things she can do with a
request, so for two days her only real options were accept or decline.

## 2. Why

`CollabRequestDetailScreen.startCounter` pre-fills the counter form from what the brand
offered, so that "no change" is the default and her counter says exactly what she touched:

```js
const cur = fromMode(t.mode);
```

`fromMode` was **never in the import line**. The file imported `PLACES, SHIPPING, toMode,
describeMode` from `utils/workingStyle` — and `workingStyle` does export `fromMode`, so the
fix is one word.

## 3. Why nothing caught it

A missing import throws only when the function **runs**. So:

| Check | Why it passed |
|---|---|
| jest smoke tests | they `require()` the module; the reference is never reached |
| the Android bundle build | same — Metro resolves modules, not identifiers |
| the duplicate-route scan | it looks at route names, not identifiers |
| every other test | **nothing taps the button** |

**This is the third time this programme has shipped "builds cleanly, dies on the handset."**
The others were three `ig.*` tokens that did not exist, and a `fonts` reference with no
import. All three were found by a person holding a phone.

## 4. The fix, and the guard

**The fix** is one word in one import.

**The guard is the point.** `utils/__tests__/importsResolve.test.js` reads each util module's
REAL exports and fails if any of them is *called* in a file that does not import it. It runs
in a second and covers both apps.

Validated the honest way: the fix was reverted, the new test was watched to fail, the fix
restored, and the test watched to pass. **A regression test that has never seen the bug
proves nothing.**

## 5. What is NOT claimed

This closes one shape of crash — a named export used without being imported. It does not
replace a linter, and it does not replace someone tapping the button. The only thing that
found this was a thumb.
