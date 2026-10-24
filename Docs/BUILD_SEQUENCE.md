# INFLX rebuild — the build sequence

Last updated **30 September 2026**. The founder's page `INFLX_Build_Sequence.html` is the source of
the order and the numbering; this file mirrors it in the repo. Rules: the master business rules
(`INFLX_Master_Business_Rules_Phase_1`, v1.29) and `Docs/OFFER_TERMS_POSTS_RULES.md` (v1.13).

The 21 items (plus the 3b insert). Each runs: rules → mockups → lock → gap check → build and test.

| # | Item | State | Contract / record | Live |
|---|---|---|---|---|
| 1 | Collaboration lifecycle map | Done (rules only) | rules v1.6 | 11 Sep |
| 2 | Pitch & invitation settings (§8A) | Built | `features/item2-pitch-invitation-settings` | 11 Sep |
| 3 | Discovery, profiles, groups (§5, 5A) | Built | `features/item3-discovery-profiles-groups` | 11 Sep |
| 3b | Social numbers via Apify (§2A) | Built | `features/item3b-social-numbers` | 11–12 Sep |
| 4 | Campaigns & sets (§5B) | Built | `features/item4-campaigns-sets` | 12 Sep |
| 5 | Choose creators, terms, invitations (§7A) | Built | `features/item5-invitations` | 13 Sep |
| 6 | Negotiation & the pool (§7B) | Built | `features/item6-negotiation` | 14 Sep |
| 7 | Agreement & two signatures (§9) | Built | `features/item7-agreement` | 14 Sep |
| 8 | Creator pitch (§8) | Built | `features/item8-pitch` | 15 Sep |
| 9 | Funding & wallet lock (§10) | Built | `Docs/ITEM9_FUNDING_LOCKING_GAP_REPORT.md` (fixes on item 7) | 17 Sep |
| 10 | Shoot plan: Store Visit (§11.1) | Built | `features/item10-store-visit` | 18 Sep |
| 11 | Shoot plan: Remote (§11.2) | Built | `features/item11-remote` (mig 191) | 22 Sep |
| 12 | Pay for Content: content to payment (§12.2) | Built | `features/item12-content` (mig 192) | 25 Sep |
| 13 | Shoppable post creation (§13, 16A) | Built as Levels 1–4 of the offer → terms → posts programme | `features/offer-builder-v2` (193), `creator-terms-v2` (194), `shoppable-posts-v2` (195), `post-links-codes` (196) | 28–29 Sep |
| 14 | Pay for Sale: going live, completion and selling (§12.1, 19; rules v1.30) | Built | `features/item14-sale-going-live` (mig 199, b5b87ebd, OTA influencer 225 / brand 235) | 30 Sep |
| 15 | Hybrid (§21, 23; rules v1.30) | Built | `features/item15-hybrid` (30e962f4, OTA influencer 226 / brand 236; no migration) | 30 Sep |
| 16 | Shopper app (§14–16A) | Built as Levels 6–7 | `features/follower-app-v2` (197), `features/shopper-ordering` (198) | 29–30 Sep |
| 17 | Wallet, complete (§17, 18, 21; rules v1.31 §17A) | Built | `features/item17-wallet` (mig 200, a5c77aab, OTA influencer 227 / brand 237) | 1 Oct |
| 18 | Disputes (§22, 26) | Parked by the founder at the discussion stage | `features/item18-disputes/00-discussion` (the map of what can go wrong, the survey, 13 open decisions) | 9 Oct |
| 19 | Home and Needs You (§24; rules v1.32) | Built | `features/item19-home` (2d4c47e3, OTA influencer 233 / brand 244; no migration) | 9 Oct |
| 20 | Creator who owns a brand (§2D; rules v1.33) | Built | `features/item20-own-brand` (df21784c, migration 206, OTA influencer 234 / brand 245) | 10 Oct |
| 21 | Pay for Content shoppable posts + Entire store (§7A, 12.2, 19, 21, 22; rules v1.34) | Built, not deployed | `features/item21-content-posts` (migration 209) | — |
| 22 | Launch clean-up | Later | — | — |

## Why 13 and 16 came before 14 and 15

Shoppable posts are made from what the creator was given, so offers (Level 1, brand website) and
creator terms (Level 2) were rebuilt first; posts (3) and links (4) followed; the shopper app (6)
and ordering (7) made the posts buyable. Level 5, post performance, is drawn
(`features/post-performance`, not locked); its social-links half belongs to item 14.

## What items 14 and 15 start from (survey 30 Sep 2026)

- After a Pay for Sale or Hybrid shoot, **both apps stop at "shoot done"**. The content step is
  Pay for Content only (`contentGate.service.js:119`, `contentFlow.service.js:109`), and the shoot
  screens show "Go to your content" only for `engagement`.
- **Nothing marks a sale collaboration Completed.** `'completed'` is written only by
  `contentMoney.releaseFinal` (Pay for Content).
- **Hybrid's second and third payments** can be released only by the Admin manual release.
  `contentMoney.releaseSecond / releaseFinal` were written for items 14/15 to reuse.
- **Minimum shoppable posts** is stamped (`campaign_influencers.min_shoppable_posts`) and counted
  (`shoppablePosts.doneCounts`), shown only on her Create tab; nothing flags the brand.
- **No social links on posts**; no social-number scraping per post.
- **Delayed** covers sale collaborations for shoot stages only; there are no post-shoot stages.
- **Commission** is credited per item at Place order regardless of the collaboration's state.
  The return window is admin-controlled and built: default on Admin → Settings → Payments
  (`payment_config.return_window_days`), per category on Admin → Pricing → Categories
  (`categories.return_window_days`, overrides the default). Both 30 today.

## Decisions for items 14 and 15 (founder, 30 Sep 2026)

The going-live step merges §12.1 with the posts rules' §4.16: brand approves the social version
(item 12's package and rounds), confirms live once per collaboration, Pay for Sale confirms itself
after the admin days (Hybrid never), links now and social numbers later (Level 5). Written into the
master rules as **v1.30 (items 14 and 15 only)** after the mockup lock. `OFFER_TERMS_POSTS_RULES.md`
is reference for the built items 13 and 16 and is not edited in this work.
