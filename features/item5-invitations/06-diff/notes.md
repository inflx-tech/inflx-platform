# item5-invitations — before / after

**Before:** the founder's locked mockups (`04-preview/mockups/item5-invitations-locked.html`, I1–I15,
updated 12 Sep with "Asked for another date" on I9 and the Closed state on I15). On the phone before this
item: "Add creators" showed a "Coming soon" toast; the creator's Collabs tab was four empty states. On the
server: one creator per request through a 400-line handler; no numeric rule on fee or commission; no
withdraw or remove (the brand's cancel wrote an invalid status and always failed); the creator's detail
returned the brand's brief and budgets.

**After:** the screens as built, verified by render tests (17 new; whole mobile suite 459 / 459) and the
backend rules verified against the real database (26 new; full suite 229 failed / 940 passed / 1169,
0 new failures against the item 4 baseline of 229 / 914 / 1143). No device was attached to this session,
so there are no phone screenshots; nothing is tested end to end until after item 7 (PROMPT §12).

## Screen by screen

| Mockup | Built as | Differences from the mockup |
|---|---|---|
| I1 Add creators | `BrandSetPickCreatorsScreen` + `DiscoverList` (`pickState`) | None in copy. Ineligible rows are shown locked (not hidden) for Store Visit sets too, with the same "Can't invite". |
| I2 Invite a group | `BrandGroupInviteCheckScreen` | None. |
| I3 / I4 / I5 Terms | `BrandCreatorTermsScreen` + `DeliverablesEditor5`, `ScopePickerSheet5` | "Some categories" picks **one** category (the row stores one category node); the minimum hint reads "{First}'s minimum is 12%." because the server does not name the category. |
| I6 Follower offer | `OfferSheet5` | None. The preview comes from `POST /campaigns/preview-basket` on the brand's first (or a chosen) product. |
| I7 Special offer | `SpecialOfferSheet5` | "Buy more, save more" tiers are spend-based (₹ → % off), the mockup's shape. |
| I8 Review and send | `BrandReviewSendScreen` | Adds the founder's "Remove {n} and send the rest" after a failed batch. |
| I9 The set after sending | `BrandSetDetailScreen` | Empty groups hidden; "+{n} more" after 50 rows. The "Another set" chip is informational until item 4's moved-out list has a screen. |
| I10 One creator | `ActionSheet` + `ConfirmSheet` + `TermsSentSheet5` | "Open profile" crosses to the Creators tab. |
| I11 / I15 Creator · Invites | `CollabsScreen` + `InvitationCard5` | The "Pitch a brand" card now sits on the Pitches tab (it used to sit on every tab). |
| I12 / I13 Invitation | `InvitationScreen` | None. |
| I14 Accept / decline | `ConfirmSheet`, `DeclineSheet5` | None. |
| Counter | `CounterSoonScreen` | Shown only when `canCounter`; writes nothing. |

## Behaviour changes a user could notice
The website's "Cancel assignment" now works (as a remove). A set-expiry tick no longer closes a creator
who asked for another date. A creator offer with a future start date no longer discounts, or is advertised,
before it. A sale stores the offer id it used. The legacy creator endpoints no longer return the brand's
brief, budgets or coupon prefix. `PATCH …/influencers/:ciId` refuses every row.
