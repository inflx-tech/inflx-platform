# item21-content-posts — code survey (24 Oct 2026)

Both ends looked at: master rules v1.33 (Downloads), `Docs/OFFER_TERMS_POSTS_RULES.md` (v1.17+),
backend services, phone screens, production data (read only). Verdicts per [[feedback_survey_before_spec]]:
**Works · Server only · Screen only · Broken · Missing · Unknown**.

## 1. Three money shapes
| Capability | Verdict | Evidence |
|---|---|---|
| Pay for Sale = commission only; Hybrid = fee + commission; Pay for Content = fee only | Works | `collabTerms.model.js:103-105 moneyShapeFor`; `invitationTerms.service.js:9-11`; negotiation writes per Aim `negotiation.service.js:577-596`; master rules §21 table |
| Pay for Content terms = fee, deliverables (type+count), note, usage rights | Works | `BrandCreatorTermsScreen.js:210-231`; `invitationTerms.service.js:143-169`; `agreementTerms.service.js:285-296` |

## 2. Shoppable posts are closed to Pay for Content
| Capability | Verdict | Evidence |
|---|---|---|
| Post-creation door refuses Pay for Content | Works (as designed) | `shoppablePosts.service.js:54 SELLING=['conversion','hybrid']`, `:83 postable()`, `:93 myCollabs` filters by goal |
| Minimum posts stamped only for selling Aims | Works | `invitationSend.service.js:326` (`SELLING_GOALS.includes(goal) ? admin minimum : null`) |
| Minimum shown to both sides only when selling | Works | `invitationRows.service.js:149`, `agreementTerms.service.js:292-294`, phone `InvitationScreen.js:147`, `AgreementScreen.js:140` |
| "What she can sell" (offers + products without offers) only when selling | Works | `BrandCreatorTermsScreen.js:130,183-208`; `invitationSend.service.js:138 validateTerms(... sell:true)`, `:190 resolveSell`, `:193`; `creatorTerms.service.js` header |
| Content step gate: Pay for Content one path; sale/hybrid two paths | Works | `contentGate.service.js:148-149,165-173`; `contentFlow.service.js:190-246 shapeSale`; `saleLive.service.js` header |
| Path 2 locked until first approved post (sale/hybrid) | Works | `saleLive.service.js` header; `copy14.js:54 lockedWhy` |
| Completion for sale/hybrid waits for the minimum | Works | `saleLive.service.js:315-345 completeIfDue` |
| Pay for Content money: brand confirm → 25%; final 50% at stamped date → Completed | Works | `contentMoney.service.js releaseSecond/releaseFinal`; `contentFlow.service.js:679-736 confirmLive` |
| Final release checks nothing but the date | Works (today's rule) | `contentMoney.releaseFinal` + `contentJobs.service.js` (due rows only) |

## 3. Money on a sale through a post
| Capability | Verdict | Evidence |
|---|---|---|
| Creator share = ci.commission_pct; null → 0 | Works | `orderPricing.service.js:490-491` (item 20 precedent `own_brand || commission_pct == null ? 0`) |
| INFLX share = brand's post-sale rate (Path B) | Works | `orderPricing.service.js:403-407 feeRateForPostSale` |
| Post stats say "₹X to you" vs "sales" for no-commission posts | Works (own-brand only) | `shoppablePosts.service.js:484-487 salesWords(own)` — keyed on `own_brand`, NOT on commission 0 → needs widening |
| Creator wallet / Commission list exclude zero-commission sales | Unknown | item 20 excluded own-brand by flag; a Pay for Content sale would be a collaboration sale with commission 0 — must be checked at build (wallet lists by ci) |

## 4. Allocation (what she can sell)
| Capability | Verdict | Evidence |
|---|---|---|
| Offers: tick one or more, "Select all"; shown only if valid for posting date | Works | rules §2.3; `creatorTerms.offerChoices` |
| Products without offers: none / all / chosen; FROZEN at sending | Works | `campaign_influencers.sell_mode CHECK ('none','all','chosen')` mig 194:29; `sell_product_ids uuid[]`; rules §2.4 |
| Offers LINKED (collab_offers); ending reaches her; drop-out of unsigned invitations | Works | `creatorTerms.dropEndedOffer`, `unsignedWith` |
| "Entire store" (all offers + all products, living) | Missing | rules §2.2 "Whole store … removed"; decision log row 1; no sell_mode value, no code path |
| New offers never join after signing | Works (rule to be relaxed for Entire store only) | rules §2.8; `creatorTerms` header "can't be … added after signing" |
| Remote parcel products: sale from her scope, content from whole catalogue | Works | master rules §11.2 (rules133.txt:624) |

## 5. Screens that must learn Pay for Content has posts
| Screen | Today | Evidence |
|---|---|---|
| Creator Create › Which collaboration | selling only | `PostCollabScreen.js:26-48` reads `/collaborations` (filtered by `myCollabs`) |
| Creator Home / Needs You "post needed" | selling only | `home.service.js:505-520 creatorPostRows` uses `myCollabs` |
| Brand set screen "Posts" button | every set (data empty for content) | `BrandSetDetailScreen.js:312` |
| Going live (creator + brand) | content: one path `shape()`; sale: `shapeSale()` | `contentFlow.service.js` |
| Terms screen (brand), Invitation, Counter, Agreement (creator) | no posts row / sell row for engagement | files in §1–§2 |
| Website End-offer dialog warning | counts unsigned invitations holding the offer | memory Level 2 |

## 6. Production (read only, 24 Oct 2026)
- Sets by Aim: conversion 25 · hybrid 6 · engagement 6.
- Pay for Content collaborations: 12 (invited 6, contracted 4, active 1, completed 1) — **all `sell_v2=false`** (old terms).
  None can gain the posts step; only invitations sent after this goes live carry it.
- Approved v2 posts: 11, all Pay for Sale. 0 posts on any Pay for Content collaboration.

## 7. Verdict summary
Nothing requested exists today. Every piece has a precedent to reuse: the two-path step (item 14),
the minimum count (item 6/14), zero-commission pricing and "sales" wording (item 20), the two
allocation rows (Level 2). The one genuinely new mechanism is **Entire store as a living allocation**,
which touches the allocation resolver, the post picker, the End-offer warning and the agreement words.
