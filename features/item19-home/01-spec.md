# item19-home — spec

**Item 19 of 21: Home and Needs You.** Designed from the code, not from the older documents (founder,
9 Oct 2026: "analyse entire code… don't go by documents"). Survey record:
`00-survey/code-survey-2026-10-09.md`. Board: `04-preview/mockups/item19-home-v3.html` (BH1–BH6,
CH1–CH5). Master rules §24 is rewritten to match as v1.32 once the board is locked. Builds on items 2–17.

## Founder decisions (9 Oct 2026)
| # | Decision |
|---|---|
| H1 | Home is **four sections, always in this order**: Needs you · Waiting on others · Money · Campaigns (brand) / Running now (creator). |
| H2 | Each section shows **two or three things**. The heading and "See all" open the full list. |
| H3 | An approved account **opens on Home** (today: Creators / Collabs). |
| H4 | The **brand gets a bell** and a notifications list like the creator's. The creator's notification kinds that do nothing when tapped get their screens. |
| H5 | The brand's list carries one row, **"N orders to pack"**, that opens the website. Orders on the phone are a separate item. |
| H6 | The **Home tab icon carries the count** of things that need you. |
| H7 | **Setup items sit in the same list**, at the bottom unless they block something. |
| H8 | The list is **ordered by urgency**: dates in the next three days, then what holds up someone's payment or next step, then the oldest. |
| H9 | *Open, drawn as kept:* the creator's store link as one line with Copy under her fourth section. |

## State today (survey 9 Oct 2026 — verify each before building on it)
- `HomeTab` in both apps is `components/shell/PendingHomeScreen.js`: approved → "Home is coming soon";
  pending → Under review + the Finish-profile sheet. Approved accounts open on Creators / Collabs.
- The one-button-per-row rule exists and is right: brand per set (`invitationRows.creatorsForSet` +
  `setRowStep`), creator across her rows (`invitationsForCreator` + `cardStep`). It misses some moves
  (below) and never delivers Delayed.
- Two older "needs you" server counts exist and are wrong (`/brands/me/inbox-summary` → `needs_you`,
  `/influencers/me/needs-you`). **Home is not built on them.** Neither has a phone caller.
- Brand phone: no bell, no notifications list, no orders screen. Creator: a bell on Collabs (no count),
  a list whose tap handles 5 of 13 screen codes.
- No tab carries a count.

## What item 19 delivers
1. **One Home read per side** (names settled at impact) returning: needs rows + count, waiting rows +
   group counts, the three money lines, the fourth section's rows, the unread-notice count.
2. **Brand Home** (BH1), **Needs you, all** (BH2), **Waiting on others, all** (BH3), the quiet state
   (BH4), the first-day state (BH5), **Notifications** (BH6).
3. **Creator Home** (CH1), **Needs you, all** (CH2), **Waiting on others, all** (CH3), the quiet state
   (CH4), the first-day state (CH5).
4. Opening tab = Home when approved; the count on the Home tab icon.
5. The creator's dead notification taps opened; the bell on her Home carries the count.
6. Fixes the list depends on: Delayed delivered to rows; Sign / Send agreement / Answer not offered
   after the cutoff; "Send the products back" given a door.
7. **Back returns to Home.** A row opens a screen inside another tab; Back from it comes back to
   Home, not to that tab's main page (built during the item; see `06-diff/notes.md`).

## Needs you — the rows
A row is: who (creator avatar / brand logo / an icon), one sentence, context (campaign · set), an
optional "why now" (a date or what waits), and **one button** using the word the existing screen uses.
The button opens the existing screen. Count rows ("3 new pitches") are one row.

**Brand**
| Row | When | Button | Opens |
|---|---|---|---|
| Sign the agreement | she signed, yours missing, before the cutoff | Sign | BrandAgreement |
| Send the agreement | she accepted and none is out, before the cutoff | Send agreement | BrandAgreement (preview) |
| Reply to her counter | negotiation open, your turn | Reply | BrandThread |
| Answer her request for another date or mode | request unanswered | Reply | BrandThread |
| Plan the visit | Store Visit, plan not sent | Plan the visit | BrandShoot |
| Reply on the visit time | visit-time thread, your turn | Reply | BrandShoot (as the set row does) |
| Send a new time | agreed time passed, nothing marked | Plan the visit (the set row's word) | BrandShoot |
| Confirm the shoot | she marked the visit | Confirm shoot | BrandShoot |
| Pick the products and book the parcel | Remote, her address is in, no live parcel | Open | BrandRemote |
| Book it again | the parcel came back to the store | Open | BrandRemote |
| Look at what arrived different | an item flagged missing or damaged, not yet seen | Open | BrandRemote |
| Confirm the return | the return reached you or she sent it herself | Open | BrandRemote |
| Review the content | Pay for Content, package waiting | Review it | BrandContent |
| Confirm it is live | she posted and added links (Pay for Content) | Confirm live | BrandContent |
| Review the social version | Pay for Sale / Hybrid, waiting for you | Review it | BrandSaleLive |
| Confirm it is live | she posted (Pay for Sale / Hybrid) | Confirm live | BrandSaleLive |
| N pitches | new pitches, or a pitch thread on your turn | Open | Creators › Pitches |
| N creators agreed, need a set | entries waiting in the pool | Open | BrandPool |
| N orders to pack | confirmed shop orders not yet packed | Open ↗ | the website's orders page |
| Your withdrawal could not be processed | latest request ended that way | Open | BrandWithdrawals |
| Add your bank account | the brand has sales and no bank account (never for a wallet it only loaded) | Open | BrandWalletDetails |

**Creator**
| Row | When | Button | Opens |
|---|---|---|---|
| Answer the invitation | invited, before the cutoff, no date request waiting | Open | Invitation |
| Reply to the counter | negotiation open, your turn | Open | Thread |
| Review and sign | agreement with you, before the cutoff | Review & sign | Agreement |
| Answer the visit plan | plan sent, time not agreed | Open | Shoot |
| Reply on the visit time | visit-time thread, your turn | Open | ShootThread |
| Mark the visit done | from the day of the agreed visit, until she marks it or a new time is set | Open | Shoot |
| Send your delivery address | Remote, not sent | Open | RemoteAddress |
| Correct the address | the parcel came back and one correction is allowed | Open | RemoteAddress |
| Say what turned up | parcel delivered, an item unanswered | Open | MyRemote |
| Mark the shoot done | every item answered | Open | MyRemote |
| Send the products back | shoot done, return items with you, no return booked | Open | MyRemote |
| Upload and send your content | Pay for Content, nothing sent | Open | Content |
| Make the changes | the brand asked (content or social version) | Open | Content / SaleLive |
| Post it and add the links | approved (content or social version) | Open | Content / SaleLive |
| Shoppable post needed | below the minimum, before the posting date | Start | Create (new post for that collaboration) |
| A post was sent back | INFLX asked for a fix | Fix | PostStatus |
| Send what you'll share | Pay for Sale / Hybrid, a post is approved | Open | SaleLive |
| Reply on your pitch | pitch thread, your turn | Open | PitchThread |
| Instagram / YouTube needs fixing | INFLX could not read the account | Open | YourNumbers |
| Invitations are paused | her setting | Open | InvitationSettings |
| Add payment details | Available above zero and none saved | Open | CreatorWalletDetails |
| Your withdrawal could not be processed | latest request ended that way | Open | CreatorWithdrawals |

Not rows: a brand's own draft campaign or set (the Campaigns tab's Drafts owns it); "tell INFLX the
brand is silent" (it stays inside the collaboration; the row reads Waiting).

**Order (H8).** Tier 1: the row has a date in the next three days, or is Delayed — nearest date first.
Tier 2: it holds up the other side's payment or next step (brand: confirm live, confirm shoot, review,
send agreement, book the parcel, confirm the return, orders; creator: every collaboration row).
Tier 3: the rest (pitches, pool, posts, setup). Inside a tier: oldest first, by when it became yours.
A setup row rises to tier 2 when it blocks money (a failed withdrawal; no payment details with money
Available). Home shows the first three; the count is the number of rows.

## Waiting on others
The collaboration rows that carry a tag instead of a button, plus (creator) pitches sent and posts in
review at INFLX. Groups for the full screen — brand: Creators · INFLX; creator: Brands · INFLX ·
Pitches. Home shows three (nearest date first) and the total. A row is never in both lists.

## Money
Three lines in the Wallet's own words and figures. Brand: Available · Locked in collaborations (n
collaborations) · Sales money coming (n sales not added yet). Creator: Available · Collaboration
payments (n collaborations · next on date) · Commission (n sales not added yet). The heading opens the
Wallet tab; a line opens its own list. No new money figure is introduced.

## Fourth section
**Brand — Campaigns:** live campaigns, nearest posting date first, up to three: name, Live, "n sets ·
next posting date", "x invited · y signed · z waiting · w declined" (the Campaigns card's own line).
Heading → Campaigns tab on Live. None live → one line saying so, with the same link.
**Creator — Running now:** the collaborations Collabs › Active lists, nearest posting date first, up
to three: brand, campaign · aim, "Posts date · you earn …". Heading → Collabs on Active.

## Notifications
Brand: a bell on Home with the unread count; a list screen like the creator's; a tap opens the screen
the notice names (`set_detail`, `brand_thread`, `brand_pitch`, `brand_shoot`, `brand_remote`,
`brand_content`, `brand_going_live`, `pool`, `wallet`, `campaign_detail`); an order notice opens the
website's orders page. Creator: the bell moves onto Home with its count (Collabs keeps its own);
`my_content`, `my_shoot`, `my_remote`, `my_pitch`, `invitation_thread`, `wallet`, `earnings`,
`collabs` open their screens. Opening the list marks all read, as today.

## Unchanged
The Under review Home and its Finish-profile sheet; the tab lock for accounts not yet approved; the
Wallet, Campaigns, Creators, Collabs, Create and Profile tabs; every screen a row opens.

## Out of scope
Orders on the brand phone; disputes (item 18, parked); the brand website's home page; opening a
screen from a tapped push notification (considered at impact — in only if it is the same routing map
and needs no new app build); any new number not already served (see the board's source table).
