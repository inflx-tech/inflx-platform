# Workflow — maestro-infrastructure

## First-time setup (founder runs once, per LOCAL.md)

1. **Install Maestro CLI.**
   - Windows (PowerShell, admin):
     `iwr -useb https://get.maestro.mobile.dev/install.ps1 | iex`
   - macOS: `brew tap mobile-dev-inc/tap && brew install maestro`
   - Verify: `maestro -v` (expect a version string).
2. **Install Android Platform Tools** (for `adb`) if not present:
   download from
   `https://developer.android.com/studio/releases/platform-tools`
   and add to PATH. Verify: `adb devices`.
3. **Get a target device or emulator running.** Two paths:
   - **USB device:** enable developer options + USB debugging on
     the phone, plug in USB, accept the RSA prompt. `adb devices`
     should list it.
   - **Android emulator** (if Android Studio is installed):
     `emulator -list-avds` then `emulator -avd <name>`. `adb
     devices` should list it as `emulator-5554` or similar.
4. **Install the follower app variant on that device:**
   `pnpm dev:android` from repo root (calls
   `react-native run-android --variant=influencerDebug`; for the
   follower variant use `cd Packages/Mobile && pnpm android:follower`).
5. **Confirm readiness:** `pnpm qa:maestro:doctor` should print all
   greens. If anything's red, the doctor names the fix.

## Daily run

```bash
pnpm qa:maestro         # discovers qa/maestro/flows/*.yaml, runs each
                       # writes per-flow logs + screenshots to
                       # qa/artifacts/qa-mobile/<timestamp>/
                       # exits 0 only if all flows passed
```

## When something is wrong

`pnpm qa:maestro:doctor`. Positive checks:

- `maestro` on PATH (version reported)
- `adb` on PATH (version reported)
- At least one device/emulator connected (`adb devices`)
- The follower-app package installed on the device
  (`adb shell pm list packages | grep in.inflx.app.follower`)

Each check reports its own pass/fail with a specific fix command.

## How a future flow gets added

1. Author `qa/maestro/flows/NN-<name>.yaml` per Maestro syntax
   (`appId:` at top, then YAML list of actions).
2. (Optional) Make it part of a real product-feature contract — the
   flow is the test case for the contract's mockup. Reference it
   from `06-diff/notes.md` so the diff page links the Maestro
   run + screenshots alongside the visual diff.
3. `pnpm qa:maestro` runs all flows in sorted order; per-flow logs +
   screenshots written to `qa/artifacts/qa-mobile/<timestamp>/<NN-name>/`.
4. Failures surface loudly (which flow, which step, which assertion).

## How THIS sub-contract is verified in this turn

This is mobile infrastructure — Maestro CLI + ADB + device-or-
emulator are all founder-side. Verification this turn:

1. Syntax-check all 2 new `.mjs` scripts.
2. Run `pnpm qa:maestro:doctor` — the **expected output is RED** for
   the agent (Maestro not installed on the agent side). That IS the
   demonstration: the doctor surfaces missing dependencies loudly
   with the correct install command, never silent-greens.
3. Confirm directory structure + flow YAML files exist and are
   syntactically valid (Maestro flow YAML is just YAML; `node -e
   "require('js-yaml')"` to lint... or simpler: just confirm the
   files parse as YAML via a small Node check using a string-only
   YAML parse).
4. Regression: `pnpm qa` 66/C1/gate 0 + `pnpm qa:db` 382/382
   unchanged.
5. Step-14 release: commit + push (deploy-inert; gov-check exit 0).
6. **Founder runs `pnpm qa:maestro:doctor` on his end after Maestro
   install** — that's the final green proof for THIS contract.
   Sub-contract 4 will produce the first real green Maestro flow.

## Commands summary

```bash
pnpm qa:maestro:doctor    # verify Maestro + ADB + device readiness
pnpm qa:maestro           # run all qa/maestro/flows/*.yaml
```
