# Reality audit — stages 1 to 4

**Written 2026-08-30.** Every row was checked by opening the file, the table or the live data.
Nothing here is from memory. Where I checked production, the row counts are real.

**Verdicts**

| | |
|---|---|
| ✅ **exists** | built, working, nothing to do |
| ⚠️ **exists but wrong** | built, and does the wrong thing |
| 🟡 **partial** | some of it is there |
| ❌ **missing** | not built |

---

# Stage 1 · Find, agree and build

## Finding creators

| Item | DB | Backend | App | Verdict | Where I looked |
|---|---|---|---|---|---|
| Search creators by niche, city, followers | ✅ | ✅ | ✅ | **exists** | `BrandFindCreatorsScreen`, `influencer.controller` |
| Save a group of creators | ✅ | ✅ | ✅ | **exists** | `BrandGroupsScreen`, `BrandGroupDetailScreen` |
| Invite one by one | ✅ | ✅ | ✅ | **exists** | `campaign_sets.influencer_mode = 'handpick'`, 11 rows |
| Invite an open group | ✅ | ✅ | 🟡 | **partial** | the value exists in schema; **0 sets in production use it** |
| Invite by filter match | ✅ | 🟡 | ❌ | **partial** | `open_group_filters` column exists, no screen drives it |

## The set

| Item | DB | Backend | App | Verdict | Where I looked |
|---|---|---|---|---|---|
| Set has a name and an aim | ✅ | ✅ | ✅ | **exists** | `campaign_sets.name`, `.goal` |
| **Set has a shoot mode** | ❌ | ❌ | ❌ | **missing** | no column on `campaign_sets` — the mode is guessed per contract today |
| **Set has one posting date** | 🟡 | 🟡 | 🟡 | **partial** | `window_start`/`window_end` exist; `window_end` is only written for pay-for-content sets |
| Channels on the set | ✅ | ✅ | ✅ | ⚠️ **exists but wrong** | `channels_json` is on the set; **you want it per creator** |
| Posting date ≥ today + 7 | ❌ | ❌ | ❌ | **missing** | no minimum is enforced anywhere |
| Invitations close 3 days before | ❌ | ❌ | ❌ | **missing** | nothing closes invitations at all |
| Campaign asks for a start date | ✅ | ✅ | ✅ | ⚠️ **exists but wrong** | `BrandCampaignCreateScreen` asks; **you want it gone** |
| Campaign end date | 🟡 | 🟡 | ❌ | **partial** | column exists, 2 of 12 rows set, nothing asks for it — correct for a sales campaign |
| Four dead date columns | ⚠️ | — | — | ⚠️ **exists but wrong** | `content_start_date`, `content_end_date`, `post_date`, `campaign_influencers.window_*` — **all zero rows** |

## Her terms — one message instead of two

| Item | DB | Backend | App | Verdict | Where I looked |
|---|---|---|---|---|---|
| Commission % per creator | ✅ | ✅ | ✅ | **exists** | `campaign_influencers.commission_pct` |
| Money per creator | ✅ | ✅ | ✅ | **exists** | `agreed_fee`, `influencer_budget` |
| What she can sell | ✅ | ✅ | ✅ | **exists** | `alloc_scope` and siblings; shipped this week |
| Her shopper offer + its dates | ✅ | ✅ | ✅ | **exists** | `brand_offer_id`, `offer_valid_from/until`; shipped this week |
| **Deliverables per creator** | ❌ | ❌ | ❌ | **missing** | `formats_json` is per **set** today |
| **Channels per creator** | ❌ | ❌ | ❌ | **missing** | set-level only |
| **One message carrying all of it** | 🟡 | 🟡 | ❌ | **partial** | `invite` already carries commission, allocation and offer — **the terms and the second step are what is missing** |
| The two-step brief | ✅ | ✅ | ✅ | ⚠️ **exists but wrong** | agreement then brief; **to be collapsed** |

## Negotiation

| Item | DB | Backend | App | Verdict | Where I looked |
|---|---|---|---|---|---|
| Counter / settle / turn-taking | ✅ | ✅ | ✅ | **exists** | `brand_collab_requests`, **41 live conversations** |
| The terms model — money, time, mode, importance | ✅ | ✅ | — | **exists** | `collabTerms.model.js`, tested |
| **A negotiation anchored to her row in a set** | ✅ | ❌ | ❌ | **partial** | ⚠️ `negotiations` table exists, keyed on `campaign_influencer_id` — **built and never used, 0 rows** |
| **Moving a creator to another set** | ❌ | ❌ | ❌ | **missing** | nothing like it exists |
| Standalone agreements | ✅ | ✅ | ✅ | **exists** | `collab_agreements`, 22 rows — **kept, stops being a prerequisite** |

## Contract

| Item | Verdict | Where I looked |
|---|---|---|
| Contract created ready to sign at briefing | **exists** | shipped 28 Aug |
| Contract shows what she can sell, her offer, her content rights | **exists** | shipped 28 Aug |
| Sign, or decline with her own words | **exists** | shipped 28 Aug |
| Brand counter-signs | **exists** | shipped 29 Aug |

---

# Stage 2 · Both sides watch the work happen

| Item | Verdict | Where I looked |
|---|---|---|
| Six-step ladder, one answer from the server | **exists** | `collabCounts.service`, `creatorSteps` |
| Brand: campaign → sets → creators → steps | **exists** | `BrandCreatorSpineScreen`, `BrandCampaignSetsListScreen` |
| Creator: the same six steps | **exists** | `CollabsListScreen`, `CollabDetailScreen` |
| Counts that add up at every level | **exists** | `collabCounts.service`, two rollups |
| The ladder starting at the set, not a handshake | 🟡 **partial** | stage names are right; the first step still means "invitation to agree" |

**This stage is nearly done.** It was built as the old Stage 3 and shipped.

---

# Stage 3 · The shoot

| Item | DB | Backend | App | Verdict | Where I looked |
|---|---|---|---|---|---|
| A shoot screen on both phones | ✅ | ✅ | ✅ | **exists** | `BrandShootScreen`, `ShootScreen` |
| Brand proposes a time, place, contact | ✅ | ✅ | ✅ | **exists** | `setVisitDetails` |
| Creator proposes or counters a time | ✅ | ✅ | ✅ | **exists** | `proposeSlot`, `counterPropose`, 2 reschedules per side |
| The bookable window, with its reason | ✅ | ✅ | ✅ | **exists** | `getVisitDateRange` — **repaired 30 Aug, was a day short on every campaign** |
| Shipping: address, dispatch, tracking, receipt | ✅ | ✅ | ✅ | **exists** | `markDispatched`, `confirmReceived` |
| What is in the parcel, item by item | ✅ | ✅ | ✅ | **exists** | `production_event_items`, 0 rows — built, never used |
| Receiving is not shooting | ✅ | ✅ | ✅ | **exists** | fixed in the old Stage 4 |
| **Mode comes from the set** | ❌ | ⚠️ | ❌ | **missing** | today it is read off the contract and **guessed when absent** |
| **Two modes, not three** | ⚠️ | ⚠️ | ⚠️ | **exists but wrong** | `visit · shipment · remote`; you want `visit · remote` |
| **Creator starts the remote one** | ❌ | ⚠️ | ❌ | **missing** | the brand does everything today; her address is auto-filled |
| **Brand marks a visit done; creator marks remote** | ⚠️ | ⚠️ | ⚠️ | **exists but wrong** | currently **both** must mark a visit — shipped 29 Aug on your earlier answer |
| Switching to remote mid-shoot | ✅ | ✅ | ✅ | ⚠️ **exists but wrong** | **to be deleted** — the mode is fixed by the set |

---

# Stage 4 · The content goes live

| Item | DB | Backend | App | Verdict | Where I looked |
|---|---|---|---|---|---|
| Deliverables exist per collaboration | ✅ | ✅ | ✅ | **exists** | `deliverables`, 1 row |
| She submits a deliverable | ✅ | ✅ | ✅ | **exists** | `DeliverableScreen`, `deliverable.controller.submit` |
| Brand approves or requests a revision | ✅ | ✅ | ✅ | **exists** | max 2 rounds |
| Deliverables only where content is bought | ✅ | ✅ | ✅ | **exists** | shipped 29 Aug |
| **She schedules and marks it scheduled** | ❌ | ❌ | ❌ | **missing** | no scheduled state anywhere — `grep` finds nothing |
| **Brand confirms the post went live** | 🟡 | 🟡 | 🟡 | **partial** | `live_confirmed_at` exists, **0 rows**, no screen drives it |
| Shoppable posts | ✅ | ✅ | ✅ | **exists** | `creator_posts`, 3 rows — submitted 2, rejected 1 |
| Admin reviews shoppable posts | ✅ | ✅ | ✅ | **exists** | `admin/posts`, `admin/approvals` in brand-web |
| **Shoppable post tied to a collaboration** | ❌ | ❌ | ❌ | **missing** | ⚠️ `creator_posts` has no `campaign_influencer_id` — it is scoped by brand, not by deal |
| **Minimum shoppable posts per collaboration** | ❌ | ❌ | ❌ | **missing** | no such setting |
| **Shoppable live before the social post** | ❌ | ❌ | ❌ | **missing** | nothing enforces the order |
| Tranches 25 / 25 / 50 | ✅ | ✅ | 🟡 | **partial** | `escrow.service`, `escrow_entries` — **0 rows, never exercised** |
| **Admin sets the final delay (7/15/30)** | ❌ | ❌ | ❌ | **missing** | the 30-day window is hard-coded |
| Her channels drive attribution | 🟡 | 🟡 | 🟡 | **partial** | link tracking exists; per-creator channels do not |

---

# The five biggest gaps

Ranked by how much has to be built from nothing.

| | Gap | Why it is big |
|---|---|---|
| 1 | **Moving a creator between sets** | Nothing resembling it exists. Rows move, dates change under her |
| 2 | **Shoppable posts tied to a collaboration** | `creator_posts` is scoped by brand, not by deal — and Stage 4's whole ordering rule depends on the link |
| 3 | **Scheduling and marking scheduled** | No state, no column, no screen. Zero of it exists |
| 4 | **Negotiation anchored to a set row** | The table is there and empty; the logic lives elsewhere and must be re-pointed |
| 5 | **Deliverables and channels per creator** | Both are per-set today. A schema move plus every screen that reads them |

---

# What surprised me

**Two things are further along than expected.** The `negotiations` table was built for exactly
the shape you have just designed — keyed on a creator's row in a set — and has never been used.
And the whole shoot machinery works; it was simply sealed shut by a mode that defaulted wrong.

**Two things are further behind.** Nothing in the system can say *"this post was scheduled"* —
not a column, not a status, not a screen. And a shoppable post has no idea which collaboration it
belongs to, which is the hinge Stage 4 turns on.

**And one thing is quietly wrong everywhere.** Four date columns are read by code and written by
nothing. One of them was silently disabling a rule in the shoot window until 30 August.
