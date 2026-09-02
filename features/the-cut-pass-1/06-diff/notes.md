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
