# B1 · Brand app, Campaigns tab

**22 screens. 3 new, 15 changed, 4 untouched.** Every button on every screen, and where it goes.

Mockups: `04-preview/mockups/b1-campaigns-tab.html`

---

## The rule every screen obeys

> **A set is one aim, one posting date, one shoot mode. Everything else is per creator.**

| Fixed for the set | Per creator |
|---|---|
| Aim | Commission % / money |
| Posting date | Deliverables *(pay-for-content only)* |
| Shoot mode — store visit or remote | What she can sell · her offer · her channels |

**Timing:** posting date ≥ today + 7 · invitations close 3 days before · a store visit finishes
1 day before.

---

# 1 · Campaign list — **change**

`BrandCampaignListScreen`

| Element | Does | Goes to |
|---|---|---|
| A campaign row — live | opens it | Campaign detail |
| A campaign row — draft | **resumes where it stopped** | Campaign builder |
| `+ NEW CAMPAIGN` | | New campaign |
| Filter chips (All · Live · Draft) | filters in place | — |

**What changes:** a set's sub-line now reads *"12 Sep · Store visit · Pay per sale"* — the two
things that make it a distinct set.

---

# 2 · New campaign — **change**

`BrandCampaignCreateScreen`

| Element | Does | Goes to |
|---|---|---|
| Campaign name | required | — |
| ~~Start date~~ | **removed** | — |
| `CREATE` | creates and opens it | Campaign builder |

**What changes:** the start date goes. A campaign is a folder; dates live on sets, which is where
they decide anything.

---

# 3 · Campaign builder — the set list — **change**

`BrandCampaignBuilderScreen`

| Element | Does | Goes to |
|---|---|---|
| A set row | opens it for editing | Set wizard |
| `Remove` on a set | confirms, then deletes | — |
| `+ ADD ANOTHER SET` — or `+ ADD YOUR FIRST SET` when empty | | Set wizard, step 1 |
| `REVIEW AND PUBLISH` | disabled until every set is complete | Review |

**What changes:** each set states its **date and mode**.

---

# 4 · Set wizard — four steps

`BrandSetWizardScreen`. The four steps already exist: **Aim · Basics · Creators · Terms.**

## Step 1 · The aim — **keep**

| Element | Does |
|---|---|
| Pay per sale · Pay for content · Both | one choice, locked once creators are in |
| `CONTINUE` | → step 2 |

## Step 2 · Basics — **change, the heaviest screen in B1**

| Element | Status | Notes |
|---|---|---|
| Set name | keep | |
| **Everyone in this set posts on** | **change** | one date replacing the two window fields |
| — minimum | **new** | today + 7, refused below that, with the reason |
| — invitations close | **new** | shown, derived, not typed |
| **Where she works** | **new** | Store visit · Remote |
| ~~Posting window from / to~~ | **removed** | becomes the one posting date |
| ~~Channels~~ | **moves** | to each creator |
| ~~Deliverables~~ | **moves** | to each creator |
| `CONTINUE` | | → step 3 |

⚠️ **The mode is fixed here and never asked again.** The shoot reads it; the contract carries it;
neither can change it.

## Step 3 · Creators — **keep**

| Element | Does |
|---|---|
| One by one · A group · By filter | three ways in |
| A creator row | adds or removes her |
| `CONTINUE` | → step 4 |

⚠️ **By filter has never had a screen.** The database supports it, nothing drives it. **Out of B1
unless you want it now** — say so and I will draw it.

## Step 4 · Terms — **change**

| Element | Does | Goes to |
|---|---|---|
| A creator row | opens everything about her | **Her terms** |
| Row badge | `READY` · `SET IT` · `NO OFFER` | — |
| `REVIEW AND PUBLISH` | blocked until every creator is ready | Review |

**What changes:** one row opens one screen. Today allocation and offer are two separate journeys.

---

# 5 · Her terms — **NEW**

The screen that replaces the entire second brief.

## Always shown

| Element | Notes |
|---|---|
| **Fixed by this set** — posting date, where she works | read-only, so she is never asked twice |

## Pay per sale

| Element | Goes to |
|---|---|
| Her commission % | — |
| What she can sell | Category picker or Product picker |
| Her shoppers get | Offers library |
| Where she'll drive traffic from — **optional** | — |
| `SEE WHAT A SHOPPER PAYS` | Basket preview |
| `SAVE` | back to step 4 |

## Pay for content

| Element | Notes |
|---|---|
| Her fee | |
| **What she owes you** | **new, per creator** — reels, posts, stories |
| **Where she'll post it** | **required** — she is paid for content, so where it goes is part of the deal |
| `SAVE` | |

## Both

Everything from both, in that order.

---

# 6 · The four pickers — **keep, all of them**

| Screen | Opened from | Changes |
|---|---|---|
| `BrandCategoryPickerScreen` | *What she can sell* | none |
| `BrandProductPickerScreen` | *What she can sell* | none |
| `BrandOffersLibraryScreen` | *Her shoppers get* | none |
| `BrandBasketPreviewScreen` | *See what a shopper pays* | none |

They stop being wizard steps and become fields inside **her terms**.

---

# 7 · Review and publish — **change**

`BrandCampaignReviewScreen`

| Element | Does |
|---|---|
| Sets · invitations going out · invitations close | a summary |
| **What happens next** | says plainly that each creator gets her whole deal in one message |
| `PUBLISH` | sends every invitation, then publishes |

**What changes:** the "agreed / not agreed" split goes — there is no pool of agreements to draw
from.

---

# 8 · She countered — **NEW, two screens**

## 8a · She countered the money

| Element | Does |
|---|---|
| You offered / she wants | the two numbers |
| **She stays in this set** | says why: the date and mode are unchanged |
| `ACCEPT` | settles it, she moves to signing |
| `COUNTER BACK` | Negotiation |
| `DECLINE` | ends it, with a reason |

## 8b · She countered the date or the mode — **the riskiest screen in B1**

| Element | Does |
|---|---|
| **This does not fit this set** | this set's date and mode against hers |
| `Move her to` — an existing matching set | picks it |
| `+ Create a set for <her date> · <her mode>` | makes one, named from her terms |
| `ACCEPT AND MOVE HER` | moves her row, **carrying her commission** |
| `COUNTER BACK` | Negotiation |
| `DECLINE — KEEP THIS SET` | ends it |

⚠️ **Nothing in the app has ever moved a row between sets.** This is the one place in B1 with no
precedent, and it gets its own contract and its own tests.

**It can only happen before signing** — you closed that question yourself: the move is a
negotiation-stage thing, so no contract exists yet.

---

# 9 · The campaign, running — **change**

`BrandCampaignDetailScreen`

| Element | Goes to |
|---|---|
| **Needs you** — *countered your terms* | She countered |
| **Needs you** — *shoots to arrange* | Shoot |
| **Needs you** — *deliverables to review* | Review queue |
| Sets · Creators · Sales | the counts |
| `Conversions` | Conversions |
| `Wallet` | Wallet |

**What changes:** *countered your terms* is a new kind of work owed. The ladder shortens by one —
there is no separate handshake step.

---

# 10 · Sets list · creators list · her steps — **change, all three**

| Screen | Change |
|---|---|
| `BrandCampaignSetsListScreen` | a set shows its date and mode |
| `BrandCampaignInfluencersListScreen` | same — ⚠️ also carried a crash fixed 28 Aug |
| `BrandCreatorSpineScreen` | six steps starting at the invitation, not a handshake |

---

# 11 · The shoot — **change**

`BrandShootScreen`

| Element | Store visit | Remote |
|---|---|---|
| Mode | **from the set**, never asked | same |
| Where · who she asks for · when | **you** send it | — |
| Her address | — | **she** sends it, you read it |
| Dispatch and tracking | — | you |
| `MARK THE SHOOT DONE` | **you** | **she** does — you see it, no button |
| ~~Switch to remote~~ | **deleted** | **deleted** |

`BrandShootsListScreen` — **keep.**

---

# 12 · Review queue — **change, in Stage 4**

`BrandCampaignReviewQueueScreen`

| Element | Does |
|---|---|
| A deliverable row | opens it |
| `APPROVE` · `ASK FOR A REVISION` | max 2 rounds |
| `CONFIRM IT WENT LIVE` | **releases her second 25%** |

Listed so the tab is complete. **The work is Stage 4, not now.**

---

# 13 · Untouched — **keep**

| Screen | Why it is here |
|---|---|
| `BrandContractScreen` | counter-signing, rebuilt 28 Aug |
| `BrandShootsListScreen` | the list is fine |
| `BrandConversionsScreen` | Stage 10 — swept, not redesigned |

---

# What I am NOT doing in B1

- The **by-filter** invite screen — no screen has ever existed; say the word and I will add it
- Anything in the Creators tab — that is B2
- Anything the creator sees — B5
- Stage 4 work behind the review queue
- Any code, until you lock this

---

# Two things to decide

**1 · Does "by filter" get a screen now?** It is in the database and has never had one. It is the
third of your three ways to invite, so leaving it out means only two work.

**2 · When she is moved, does she re-confirm?** She agreed 19 Sep and remote. She lands in a set
that is 19 Sep and remote — the same terms she asked for. **My recommendation: no re-confirmation.
She gets told she was moved, and goes straight to signing.** Asking again would be the double-ask
this whole architecture removes.
