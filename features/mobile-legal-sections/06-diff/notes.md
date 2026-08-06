# 06 — Before / after

## Before

- The legal documents existed only on inflx.in. None of the three apps linked
  to them, and neither the privacy policy nor the account-deletion route was
  reachable from inside an app — both of which the app stores look for.
- `Packages/Mobile` had no legal content of any kind.

## After

- **Follower 8 · Creator 10 · Brand 12** documents, each app showing only what
  binds its user, reached from one row on the profile screen.
- Tables render as stacked cards rather than scrolling sideways.
- Every app links out to inflx.in/legal for the full set of 14.
- The mobile text is generated from the web source, and cannot drift from it
  without failing the suite.

## Verified, with evidence

| Claim | Evidence |
|---|---|
| Screens render; every shipped document mounts | Mobile jest **27 suites / 131 tests green** — 13 new, including one that mounts every document in the bundle |
| Role slicing is correct | Explicit per-audience leak assertions, plus an ordering assertion that the shopper set stays leanest as documents are added |
| No route registered twice | grep per navigator: `LegalList` 1, `LegalDocument` 1, in each of the three |
| No unresolved token reaches a user | Asserted over the serialised bundle |
| Web and mobile cannot drift | `pnpm qa` **125 green, gate 0**, including the new `legal-sync` workflow |
| Counts are what the spec says | Generator reports `brand: 12 · creator: 10 · shopper: 8` |

## Anti-fake-green

The leak guard was **mutation-checked**. Adding `'shopper'` to the Creator
Agreement's audiences and resyncing made the shopper set 9 documents, and the
suite failed **two** tests — the leak assertion, and the list-screen assertion
that a shopper never sees that title. Reverted; checksum back to
`25df7605b92f285f`, confirmed by `--check`.

One test was **corrected rather than the code**, and it is worth recording why
that was not a weakening. The document-render test used an exact-string match
on a section heading, but a heading renders as two nested `Text` nodes (the
number, then the heading), so the parent's text content is `"1  Who we are"`
and an exact match cannot see it. It was replaced with a contained-match **and
strengthened** to also assert the first paragraph rendered — so it now proves
the body appeared, not just the chrome.

## Not verified

- **No on-device run.** `adb devices` was empty, so Maestro did not run.
  `release.released` stays `false` per Rule 5 — the founder owes one pass on a
  real device.
- The agency flavour has no Legal entry. Out of scope, recorded as a gap.
