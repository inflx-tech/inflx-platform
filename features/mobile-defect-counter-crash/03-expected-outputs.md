# Expected outputs

| # | Assertion | Check |
|---|---|---|
| E-1 | Tapping counter opens the form instead of crashing | handset, W1 |
| E-2 | The form is pre-filled from the brand's terms, so "no change" is the default | handset, W2 |
| E-3 | A counter still carries only the terms she moved | `utils/collabCounter` tests, unchanged |
| E-4 | No file in either app calls a util export it did not import | `importsResolve.test.js` |
| E-5 | That guard FAILS on the broken tree | proven by reverting and re-running |
| E-6 | Mobile suite green, bundle builds | 38 suites / 298 tests |
