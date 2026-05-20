# Expected outputs — maestro-infrastructure

## Files created

```
qa/maestro/README.md                       Maestro lane intro + structure
qa/maestro/config.yaml                     shared config (output, retries)
qa/maestro/flows/00-smoke.yaml             smoke: launch follower app + screenshot
qa/scripts/qa-maestro.mjs                   orchestrator (runs all flows)
qa/scripts/maestro-doctor.mjs              CLI + ADB + device readiness check
```

## Files modified

```
package.json (root)              +qa:maestro, +qa:maestro:doctor
LOCAL.md                         new "Mobile dev with Maestro" section
qa/scripts/dev-doctor.mjs        small informational check for Maestro
CLAUDE.md                        small addendum on the mobile-verify step
GOVERNANCE.md                    small addendum (Maestro is the mobile lane,
                                 advisory; sub-contract 5 enforces)
```

## Files NOT modified (out of scope — sub-contract 4)

- `Packages/Mobile/src/config/api.js` — the `USE_PRODUCTION` flip
  belongs with the first real flow that needs it (sub-contract 4),
  not here.
- `Packages/Mobile/**` anything — sub-contract 3 is RN-source-free.
- `qa/scripts/governance-check.mjs` — sub-contract 5.

## Visible runtime behaviour

```
$ pnpm qa:maestro:doctor
[maestro-doctor] === INFLX Maestro readiness ===
[maestro-doctor] ✗ maestro CLI not on PATH
                fix: PowerShell  iwr -useb https://get.maestro.mobile.dev/install.ps1 | iex
                     macOS       brew tap mobile-dev-inc/tap && brew install maestro
[maestro-doctor] ✗ adb not on PATH
                fix: install Android Platform Tools and add to PATH
[maestro-doctor] (deferred) device check skipped — adb unavailable
[maestro-doctor] (deferred) follower-app install check skipped — adb unavailable
[maestro-doctor] === RED — 2 failed check(s) ===
exit 1
```

After founder installs Maestro + Platform Tools + connects a device
running the follower app:

```
$ pnpm qa:maestro:doctor
[maestro-doctor] ✓ maestro CLI on PATH (v1.39.0)
[maestro-doctor] ✓ adb on PATH (Android Debug Bridge version 35.0.2)
[maestro-doctor] ✓ device connected: emulator-5554 (or RZ8M83AHJXY)
[maestro-doctor] ✓ in.inflx.app.follower installed on device
[maestro-doctor] === ALL GREEN — ready: pnpm qa:maestro ===
exit 0
```

After installing + running for the first time:

```
$ pnpm qa:maestro
[qa:maestro] discovered 1 flow: qa/maestro/flows/00-smoke.yaml
[qa:maestro] running 00-smoke (appId=in.inflx.app.follower) ...
[qa:maestro]   ✓ launchApp (1.2s)
[qa:maestro]   ✓ takeScreenshot smoke-startup → qa/artifacts/qa-maestro/<ts>/00-smoke/smoke-startup.png
[qa:maestro] === 1/1 flows PASSED ===
exit 0
```

## Failure-path outputs (loud, no fake green)

```
$ pnpm qa:maestro     # before Maestro is installed
[qa:maestro] FAIL — maestro CLI not found on PATH
             run `pnpm qa:maestro:doctor` for the fix.
exit 1
```

```
$ pnpm qa:maestro     # Maestro installed but no device
[qa:maestro] FAIL — no Android device or emulator connected (adb devices: 0)
             plug in a USB-debug phone or start an emulator, then retry.
exit 1
```

```
$ pnpm qa:maestro     # Maestro + device but app missing
[qa:maestro] (still runs) maestro test 00-smoke ...
[qa:maestro]   ✗ launchApp — package in.inflx.app.follower not installed on device
[qa:maestro] === 0/1 flows PASSED ===
exit 1
```

The doctor never green-lights when something's missing. `qa:maestro`
itself runs the doctor as a prerequisite — if doctor is RED, the
orchestrator exits 1 without attempting Maestro.

## Directory structure that lands

```
qa/maestro/
├── README.md
├── config.yaml
└── flows/
    └── 00-smoke.yaml        # appId=in.inflx.app.follower; launchApp + screenshot
qa/scripts/
├── qa-maestro.mjs
└── maestro-doctor.mjs
qa/artifacts/qa-maestro/      # gitignored; per-run timestamped subdirs
└── <timestamp>/
    └── <flow-name>/
        ├── maestro.log
        └── *.png            # screenshots from takeScreenshot steps
```
