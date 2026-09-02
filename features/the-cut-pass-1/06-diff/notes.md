# Before / after — pass 1, hiding the removed surfaces

One section per cut. Each cut is its own commit.

---

## Cut 1 — the agency app

**Removed:** `AgencyNavigator` · `AgencyHomeScreen` · `AgencyProfileScreen` ·
`AgencyWalletScreen` · `AgencyRegisterScreen` · the `agencyApi` bindings · the `agency`
Android build flavor · the `agency` OTA flavor · the shipped APK.

### Screenshots

**Not captured, and not faked.** The screens were deleted, so there is nothing to shoot
"after"; and shooting "before" would need an agency account, of which production has
**zero**. Pasting a render into both panels would satisfy the gate and prove nothing.

### What was implemented

| | Before | After |
|---|---|---|
| Apps in the build | 4 — brand, influencer, follower, agency | **3** |
| Signing in with an agency account | Routed into the agency app, or to its registration form | Falls through to "this app is for brands, influencers and followers" |
| The app's own sign-in label | Could read "Agency app" | That branch is gone |
| OTA flavors | brand · influencer · follower · agency | **brand · influencer · follower**, so `publish all` can no longer target it |
| Android flavors | 5, including `agency` | 4 |

### Verified before commit

- **Nothing imports a deleted file.** Searched the whole mobile package for every deleted
  name — `AgencyNavigator`, `AgencyRegisterScreen`, `screens/agency`, and each screen —
  and there are no references left except two explanatory comments.
- **Every edited file parses**, including JSX: `App.js`, `AuthNavigator.js`,
  `OTPScreen.js`, `PhoneScreen.js`, `api.js`, and `scripts/publish-ota.js`.
- **743 mobile tests pass** — the same count as before the cut, so nothing that survives
  changed behaviour.
- **Production holds zero agency accounts**, zero agency payouts and zero agency
  withdrawals. Checked directly, which is why this cut carries no user risk at all.

### A discipline slip, caught and reverted

Staging was done with a broad `git add -A` over several paths, which picked up
**pre-existing changes to the APK binaries and a superseded-APKs folder** that belong to
earlier work, not to this cut. Unstaged before committing. `Docs/THE_FINISH_LINE.md`'s
one-cut-per-commit rule exists precisely so a breakage is traceable to one decision, and
a commit carrying unrelated binaries would have broken that.

### What to check — the device walk

Nothing, for the agency app itself — there is no account to sign in with.

What is worth confirming is that **the three surviving apps still open normally**, since
this cut edited the file that chooses which app to show (`App.js`). That is covered by
the OTA publish and the test suite, and by opening any one of them once after the deploy.

### Known, and not fixed here

The server's `/agencies/*` endpoints, the agency database tables and the admin agency
approval queue are all still present. Removing those is passes 3 and 4.

---

## Cuts 2–4 — enquiries, the shopper reward wallet, referrals

Three separate commits, one per cut.

### What was implemented

| | Before | After |
|---|---|---|
| Shopper: enquiry form | A shop could be configured to take enquiries; a form collected them | Gone. A shop still configured that way shows no enquiry button. |
| Brand: enquiry inbox | A home tile and a full inbox, where typing a deal value credited a creator commission with no ceiling | Gone |
| Offer builder | Four redemption modes, including Enquiry, on phone **and** website | Three |
| Shopper: Profile | A "Wallet — ₹X balance" row when a balance existed | Gone |
| Creator: Earnings | A "Refer & Earn — share your code, earn for 12 months" tile | Gone |

### Verified before each commit

- **No dangling references** to any removed screen, checked by name across the repo.
- **Every edited file parses**, including JSX.
- **Tests green after each cut**: 743 → 743 → 741 → 741. The drop is the wallet screen's
  own test file removed with the screen it tested, not a regression.

### Two things worth recording

**A parity test caught a real miss.** `offerParity.test.js` asserts the phone's and the
website's offer-mode lists are identical. I removed "enquiry" from the phone only, and it
failed. Both were then updated. That test exists because these two lists drifting is
exactly how the apps end up disagreeing — and it worked.

**One adjacent fix, in scope because this change caused it.** The shop screen's fallback
showed shoppers a developer message with a raw code word — *"Action not wired"*. Removing
enquiries makes that branch **more** reachable, so leaving it would have made a known
audit finding worse. It now reads as a sentence.

### What to check — the device walk

1. **Shopper profile:** no Wallet row.
2. **Creator earnings:** no Refer & Earn tile; the withdraw form and campaign earnings
   below it still work.
3. **Brand home:** no Enquiries tile.
4. **Any shop page:** the buttons that remain (buy, pay at store) still work.

### Known, and not fixed here

All three still exist on the server, and the referral admin pages are untouched. That is
pass 3.
