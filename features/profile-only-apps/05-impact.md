# profile-only-apps — impact

**Verdict: PRODUCTION-IMPACTING via OTA only.** Every user of all three phone apps loses every
screen except their profile, on their second launch after publish. That is the instruction.

| Area | Effect |
|---|---|
| Brand phone app | Opens on Brand Profile. No Home, Creators, Campaigns, Wallet, Notifications, Media Gallery, Settings. |
| Creator phone app | Opens on Profile. No Home, Collabs, Create, Earnings, contracts, pitching. |
| Shopper phone app | Opens on Profile (guest card + sign-in, or signed-in card + Edit). No shopping of any kind. |
| Sign-in | Unchanged. |
| Backend / DB | Untouched. Nothing is erased. |
| Brand website / admin | Untouched. Brands can still run everything from the web, and the Brand Profile's "Open Web Dashboard" row still links there. |
| Push notifications | Still delivered. Tapping one opens the app on the profile; the screens they pointed at are gone. |
| Shared inflx.in links | Open the shopper app on its profile. `navigateWhenReady` swallows the missing route; it does not crash. |
| Render / Vercel | The push redeploys them with no code change from this contract. |

**Reversible:** yes. Every file is in git history. Reverting the commit and publishing an OTA
restores all three apps exactly.

**Risk checked:** the build-clean-then-crash-on-launch class, meaning a deleted file still
imported somewhere, or a name used without an import. The production bundle build and
`no-undef` lint on every edited file both came back clean.
