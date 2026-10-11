# Expected Outputs — "Done" on a post that is with INFLX

| # | Step | Observable output | How it is verified |
|---|---|---|---|
| 1 | 1 | In review: a button with testID `done`, reading "Done", after the three boxes | jest, the rendered screen |
| 2 | 2 | Pressing it opens the Home tab | jest with the real navigators (bottom tabs + native stack): the focused tab is `HomeTab` |
| 3 | 3 | The Create tab's stack is back to its main page alone | same test: the stack is `['CreateHome']` |
| 4 | 4 | Opened from the list: the button is there; Back still goes one screen back | jest |
| 5 | 5 | Sent back, approved, live, removed: no `done` button | jest, each state |
| 6 | edge | Nothing under the screen: Done opens Home and does not ask the stack to pop | jest |

## Regression gates
- `Packages/Mobile`: the whole jest suite, all passing (it was 122 suites / 2,914 tests).
- No backend, no website: nothing to run there.

## Visual evidence required
- The founder's look at the screen on his phone (the walk).
