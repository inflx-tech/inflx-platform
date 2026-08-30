# Screen map — every screen in the brand and creator apps

**Written 2026-08-30.** 44 brand screens, 28 creator screens. **72 in total, and every one is
listed.** Nothing is left off, including the ones we will not touch.

**Verdicts**

| | |
|---|---|
| **keep** | this flow does not touch it |
| **change** | exists, needs work for the new flow |
| **new** | does not exist |
| **delete** | goes away |
| **sweep** | not in this flow, but read once to confirm it still fits |
| **out** | belongs to the follower app or another programme |

---

# BRAND APP · 44 screens, 5 tabs

## Tab 1 · Home

| Screen | Verdict | Why |
|---|---|---|
| `BrandHomeScreen` | **change** | reads the six-step counts; the ladder shortens when the handshake goes |
| `BrandActionRequiredScreen` | **change** | "needs you" gains a new item — *she countered your date* |
| `BrandNotificationsScreen` | **change** | new notification kinds: countered, moved set, address received |
| `BrandDiaryScreen` | **keep** | the history reader; nothing about it changes |

## Tab 2 · Creators

| Screen | Verdict | Why |
|---|---|---|
| `BrandCreatorsScreen` | **change** | the hub loses "agreements waiting to be used" — there is no such pool now |
| `BrandFindCreatorsScreen` | **keep** | search is unchanged |
| `BrandInfluencerBrowseScreen` | **keep** | browsing is unchanged |
| `BrandInfluencerProfileScreen` | **change** | "invite" now means *invite into a set*, not *start a handshake* |
| `BrandGroupsScreen` · `BrandGroupsList` · `BrandGroupDetailScreen` | **keep** | groups feed the set invite; the list itself is unchanged |
| `BrandRequestComposerScreen` | ⚠️ **change** | this is the old handshake. It stays **only** for out-of-campaign approaches |
| `BrandCollabRequestsScreen` | **change** | same — inbound conversations only |
| `BrandProposalInboxScreen` | **keep** | creator pitches still arrive here |
| `BrandAgreementDetailScreen` | ⚠️ **change** | an agreement is a record now, not a thing you spend |
| `BrandNegotiationScreen` | ⚠️ **change** | **the big one** — it must negotiate a creator's row in a set, not a standalone request |
| `BrandInfluencerAnalyticsScreen` | **sweep** | Stage 10 work; confirm it still opens |

## Tab 3 · Campaigns — where the new flow lives

| Screen | Verdict | Why |
|---|---|---|
| `BrandCampaignListScreen` | **change** | resume-a-draft points at the new builder |
| `BrandCampaignCreateScreen` | **change** | **drop the start date** — one field, a name |
| `BrandCampaignBuilderScreen` | **change** | the set list; a set now shows its date and mode |
| `BrandSetWizardScreen` | ⚠️ **change — heaviest screen in the programme** | gains mode and posting date; loses channels; per-creator terms move in |
| **Her terms** | 🆕 **new** | commission/money · deliverables · what she can sell · her offer · her channels — **one screen** |
| **She countered** | 🆕 **new** | accept and move her to a matching set, or decline |
| **Pick or create the matching set** | 🆕 **new** | where she lands |
| `BrandAllocationScreen` | **change** | folds into "her terms" as a step |
| `BrandCategoryPickerScreen` | **keep** | used by allocation |
| `BrandProductPickerScreen` | **keep** | used by allocation |
| `BrandBasketPreviewScreen` | **keep** | "see what a shopper pays" |
| `BrandOffersLibraryScreen` | **keep** | the offer library is unchanged |
| `BrandCampaignReviewScreen` | **change** | simplifies — no agreed-vs-not split to show |
| `BrandCampaignDetailScreen` | **change** | shows a set's date and mode |
| `BrandCampaignSetsListScreen` | **change** | same |
| `BrandCampaignInfluencersListScreen` | **change** | ⚠️ also carries a live crash fixed 28 Aug |
| `BrandCreatorSpineScreen` | **change** | the six steps, shortened |
| `BrandCampaignReviewQueueScreen` | **change** | Stage 4 — approving deliverables |
| `BrandContractScreen` | **keep** | counter-signing works |
| `BrandShootScreen` | **change** | mode locked; brand marks a visit done; remote shows her address |
| `BrandShootsListScreen` | **keep** | the list is fine |
| `BrandConversionsScreen` | **sweep** | Stage 10 |

## Tab 4 · Wallet

| Screen | Verdict | Why |
|---|---|---|
| `BrandWalletScreen` | **sweep** | tranches pay out of here; confirm it reads the new releases |

## Tab 5 · Profile

| Screen | Verdict |
|---|---|
| `BrandProfileScreen` · `BrandSettingsHubScreen` · `BrandMediaGalleryScreen` | **sweep** |
| `BrandStorePreviewScreen` · `BrandOrdersScreen` · `BrandBookingsScreen` · `BrandEnquiriesScreen` | **out** — follower-side commerce |

---

# CREATOR APP · 28 screens, 5 tabs

## Tab 1 · Home

| Screen | Verdict | Why |
|---|---|---|
| `HomeScreen` | **change** | the ladder shortens |
| `NotificationsScreen` | **change** | new kinds: a whole deal arrived, you were moved to another set |
| `TransactionFeedScreen` | **sweep** | Stage 10 |

## Tab 2 · Collabs — her half of the new flow

| Screen | Verdict | Why |
|---|---|---|
| `CollabsListScreen` | **change** | six stages stay; the first now means *a whole deal arrived* |
| `CollabDetailScreen` | ⚠️ **change** | the hub. ⚠️ carried two separate crashes this week |
| **The whole deal** | 🆕 **new** | terms + what she can sell + her offer + her channels, in one, with accept · counter · pass |
| `CollabRequestDetailScreen` | **change** | out-of-campaign approaches only |
| `CollabPitchDetailScreen` | **keep** | her own pitches |
| `NegotiationScreen` | ⚠️ **change** | **the big one** — countering a set, and being told a date change moves her |
| `ContractScreen` | **keep** | rebuilt 28 Aug |
| `ContractPdfScreen` | **keep** | |
| `ShootScreen` | **change** | mode locked; **she gives the shipping address**; she marks a remote shoot done |
| `DeliverableListScreen` · `DeliverableScreen` | **change** | Stage 4 — scheduling and marking scheduled |
| `CollabTrackingScreen` | **sweep** | Stage 10 |
| `CollabDiaryScreen` | **keep** | |
| `CampaignProductsScreen` | **keep** | what she can sell |
| `BrandProfileScreen` | **keep** | |
| `CollabPreferencesScreen` | **sweep** | what she will and will not accept |

## Tab 3 · Create

| Screen | Verdict | Why |
|---|---|---|
| `CreateScreen` | **change** | Stage 4 — a shoppable post must know which collaboration it is for |
| `PostComposerScreen` | ⚠️ **change** | ⚠️ a shoppable post has **no link to a collaboration** today |
| `MyStoreScreen` | **keep** | |

## Tab 4 · Earnings

| Screen | Verdict | Why |
|---|---|---|
| `EarningsScreen` | **change** | must show the three tranches and what is still to come |
| `CommissionDetailScreen` | **sweep** | Stage 10 |
| `ReferAndEarnScreen` | **out** | referral programme |

## Tab 5 · Profile

| Screen | Verdict |
|---|---|
| `ProfileScreen` | **sweep** |
| `InfluencerContractsScreen` | **keep** |
| `ProposalsHubScreen` · `SendProposalScreen` | **keep** — her outbound pitches |

---

# ADMIN · brand-web

| Screen | Verdict | Why |
|---|---|---|
| `admin/posts` · `admin/approvals` | **change** | reviewing shoppable posts against a collaboration |
| **Two settings** | 🆕 **new** | minimum shoppable posts per collaboration; the delay before the final 50% |

---

# The count

| | Brand | Creator | Admin | Total |
|---|---|---|---|---|
| **new** | 3 | 1 | 1 | **5** |
| **change** | 20 | 10 | 1 | **31** |
| **keep** | 10 | 9 | — | **19** |
| **sweep** | 5 | 5 | — | **10** |
| **out** | 5 | 1 | — | **6** |
| **delete** | — | — | — | **0** |
| | **43** | **26** | **2** | **71** |

*(`BrandProfileScreen` exists in both apps under the same filename; counted once per app.)*

**Nothing is deleted.** The two-step brief and the remote-flip disappear as *flows*, but no screen
file goes — the screens that carried them are reused for the merged flow.

**Five genuinely new screens.** Everything else is work on something that already exists, which is
what makes this a re-plumbing job.

---

# The eight chunks, mapped

| Chunk | Screens | New | Change |
|---|---|---|---|
| **B1** Brand · Campaigns | 22 | 3 | 15 |
| **B2** Brand · Creators | 12 | 0 | 6 |
| **B3** Brand · Home | 4 | 0 | 3 |
| **B4** Brand · Wallet + Profile | 7 | 0 | 0 |
| **B5** Creator · Collabs | 15 | 1 | 6 |
| **B6** Creator · Create | 3 | 0 | 2 |
| **B7** Creator · Home + Earnings + Profile | 9 | 0 | 2 |
| **B8** Admin | 2 | 1 | 1 |

**B1 is a third of the whole job.** B4 and B7 are sweeps and will be short.
