# Batch A — before / after

**Nine changes. Eight deletions and one unblocking. No server, no database, no web.**

---

## 1. Board by board

### ① Naming the campaign

| | |
|---|---|
| **Promised** | The lock note goes; the date becomes a calendar |
| **Built** | Both |
| **Diverged** | Nothing |

The `isISODate` guard on the Continue button is untouched. `DateField` emits the same
`YYYY-MM-DD` string the text box produced, so the validation still holds — and a test asserts
it, because removing a field is exactly how a check silently loses its subject.

### ② Set basics — a sales set

| | |
|---|---|
| **Promised** | Name, start date, channels, buttons. Nothing else |
| **Built** | Exactly that |
| **Diverged** | The channels payload dropped a field — see §3 |

Eleven blocks to four. Gone: the greyed *Ends · Never*, *No end date on a sales set*, the whole
**Budget** block, *Minimum channels* and its guidance, *You are not buying posts here…*, the
*Channels a creator may use* sub-label, and the *No "who posts?" step* note.

**A pay-for-content set is untouched.** Its posting window keeps both halves, its Budget still
shows the derived figure, and *What you are buying* still counts reels and stories.

### ③ Who is in this set

| | |
|---|---|
| **Promised** | The chip goes and the button goes. Nothing replaces either |
| **Built** | Both, and nothing replaces either |
| **Diverged** | Nothing |

I had proposed keeping the hidden-creator count as a plain sentence, and put it on the board.
**Founder, seeing it: not necessary.** Removed.

**The filter is untouched** — only the explanation went. An agreement settled for a different
aim still cannot enter a commission set, because the terms would not mean the same thing on
either side. A mutation that deletes the filter along with its chip is caught.

*On the handset:* a brand who agreed with nine people and sees three will not be told why. That
was decided with the trade-off stated.

### ④ Terms

| | |
|---|---|
| **Promised** | The offer stops being compulsory. Nothing else moves |
| **Built** | Exactly that |
| **Diverged** | *"See what a shopper pays"* was asked for, then withdrawn — see §2 |

`canFinish` was
`picked.length > 0 && everyoneAllocated && (!selling || !!chosenOffer)`. The third clause is
gone. **Allocation stays compulsory** — a different rule, and a real one: a contracted creator
with no allocation is contracted and invisible in the shopping app. A mutation that relaxes it
is caught.

---

## 2. The change that was asked for and then withdrawn

*"not required What shoppers pay"* — asked 2026-08-27.

Checked before removing: that button is the **only** `navigate()` into `BrandBasketPreview`, at
`BrandSetWizardScreen.js:311`. Removing it would have left the screen built, registered and
unreachable, and falsified two assertions in `stage2CampaignWizard.test.js`.

**Told that, the founder reversed the same day: keep it.** Nothing on step 4 changes except the
gate.

Worth recording: a button that reads as clutter can be the only door to a screen, and the cost
of learning that afterwards is a dead screen nobody notices for months.

---

## 3. The one payload change

`channels_json` used to be `{ allowed, minimum }`. It is now `{ allowed }`.

The brand can no longer choose a minimum, so sending one would be guidance the app invented.
Checked before changing it, in `backend/src/services/campaignChannels.js`:

* `validateChannels` treats `minimum` as optional — `if (minimum !== undefined && minimum !== null)`
* `describeChannels` renders the list without it — no `— at least N` suffix
* Nothing else in backend, mobile or web reads it. Grepped the whole tree.

**Narrowing the picker did not narrow the platform.** The server still accepts all seven
channels, and sets created before today keep whatever they were given. Stage 7 gives the other
five their own tracked links; an enum would have needed a migration, and this is a JSON array
precisely so it does not.

---

## 4. What was cleaned up on the way

Three things became dead and were removed rather than left:

* `minChannels` state, its two props and its destructure
* `onGoAsk`, and its `navigate('Creators')`
* `wrongAim` — the `useMemo` returned a `{ matching, wrongAim }` pair; it now returns the list
  directly, because the second half had no reader left

Dead state that still gets passed down is how a screen ends up with props nobody can explain a
year later.

---

## 5. One existing test was rewritten, not deleted

`stage2CampaignWizard.test.js` asserted the wizard navigates to `Creators`. Removing *"Go and
ask someone new"* makes that false.

**Rewritten to state the opposite fact**, so the coverage moves rather than evaporating:

```js
expect(targetsIn('…BrandSetWizardScreen.js')).not.toContain('Creators');
expect(read('…BrandSetWizardScreen.js')).not.toContain('Go and ask someone new');
```

Deleting the assertion would have been the easy fix and would have left the file one line
shorter and one fact poorer.

---

## 6. How this was verified

| What | How |
|---|---|
| The changes | **31 executing checks**, `batchAWizardTrim.test.js` |
| Are they real? | **Mutation-tested. Seven deliberate breakages, seven caught** — including the one that matters most: the Budget removal leaking into content sets |
| The branch risk | Asserted structurally. The Budget check finds the branch that *owns* the Budget heading rather than assuming it is the first of four `buyingContent` blocks — an assertion that silently tests the wrong branch is worse than none |
| Server contract | Read `campaignChannels.js` before changing the payload, and grepped every reader of `minimum` across backend, mobile and web |
| Regression | Full mobile suite: **40 suites, 380 tests, all passing** |

Two of the 31 checks failed first time. **Both were my assertions being too crude, not the
code** — one banned `!!chosenOffer` everywhere when it is still legitimately used to render the
picked offer, and one grabbed the first `buyingContent` branch instead of the Budget one.
Corrected rather than loosened.

**Certified no-regression. Never claimed green** — the backend suite is unaffected by this batch
and still cannot run.

---

## 7. What to check on the handset

⚠️ **Build a pay-for-content set.** That is the walk that matters. Batch A only takes things
away from the commission path, so it cannot really break it. The risk is a removal leaking into
the content branch — and that would not crash. It would silently drop the budget, and the
campaign would refuse to publish weeks later.

Then build a commission set and see whether four blocks feels *right* rather than merely
shorter. Only a person can answer that.
