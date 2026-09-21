# INFLX rebuild — the build sequence

Last updated **21 September 2026**. Assembled from the only authoritative sources in the repo:
each locked mockup's own header (`Item N of 21`) and footer, the gap reports, the item contracts'
`lock.json` release blocks, and the rules-doc changelog. Nothing here is inferred.

**One gap worth closing: items 14–21 are not recorded anywhere.** The mockups count to 21, but no
document in this repo names items 14 onwards. What follows is everything that *is* written down.

---

## Done and live

| # | Item | Contract | Live since | Latest OTA at the time | Walk fixes |
|---|---|---|---|---|---|
| 1 | The lifecycle rules pass — produced rules, not code (rules v1.6: "lifecycle details from item 1 — invitation and signing deadlines, funds locked at signing, Delayed collaborations") | — | 11 Sep | — | — |
| 2 | Pitch & invitation settings (§8A) | `features/item2-pitch-invitation-settings` | 11 Sep | brand 210 / inf 198 | 1 |
| 3 | Discovery, profiles, groups (§5A) | `features/item3-discovery-profiles-groups` | 11 Sep | brand 211 / inf 199 | 1 |
| 3b | Social numbers via Apify (§2A) — an insert, not one of the 21 | `features/item3b-social-numbers` | 11 Sep | brand 212 / inf 200 | — |
| 4 | Campaigns & sets (§5B) | `features/item4-campaigns-sets` | 12 Sep | brand 214 | — |
| 5 | Sending invitations (§7A) | `features/item5-invitations` | 13 Sep | brand 215 / inf 202 | — |
| 6 | Negotiation, rounds & the pool (§7B) | `features/item6-negotiation` | 14 Sep | brand 216 / inf 203 | — |
| 7 | The agreement & two signatures (§9) — the first item that moves money | `features/item7-agreement` | 14 Sep | brand 217 / inf 204 | 2 |
| 8 | The creator's pitch (§8) — *"the last item before the end-to-end test pack"* | `features/item8-pitch` | 15 Sep | brand 218 / inf 205 | — |
| 9 | Funding & locking the money (§10) — no mockups of its own; its gap report drove fixes recorded on item 7's contract | `Docs/ITEM9_FUNDING_LOCKING_GAP_REPORT.md` | 17 Sep | inf 211 | (on item 7) |
| 10 | The Store Visit shoot plan (§11.1) | `features/item10-store-visit` | 18 Sep | **brand 229 / inf 216** | 2 |

**Current live OTA: brand 229, influencer 216** (item 10's walk fix, 20 September).

Interleaved with these, outside the numbered sequence, went the registration/profile rebuild,
retiring Google, the creator-distance work, the handle-change review, change-login-number and the
subscriptions master switch — all live.

## Next, and recorded

| # | Item | Where it is written | What it needs |
|---|---|---|---|
| 11 | **The Remote shoot (§11.2)** — her address, product selection, dispatch, courier, receipt, returns vs gifts | Item 10's mockup footer: *"Item 11 is the Remote shoot"*; handover notes in `features/item10-store-visit/05-impact.md` | Extends item 10's table, gate, Delayed lane and F1 shape. Starts with two known defects: `addParcelItems` passes an undefined brand id, and the Delayed lane is scoped to visits only. |
| 12 | **The content (§12, §12.1)** — the shoppable post, the named social deliverable, and the confirmation that finally releases Hybrid's second and third payments | Item 10's footer: *"item 12 is the content, where Hybrid's waiting payments finally get their trigger"*; rules v1.22 change 1 | Reads item 10's completed shoot. Sets `delayed_stage = 'content_not_live'` on the flag item 10 built. **₹9,375 is still locked in production waiting for this.** |
| 13 | **Shoppable posts / the Brand Store feed (§13, §16A)** | Item 3's footer: *"Items 4, 5, 8 and 13 fill in … the post grids"*; item 7's gap report: *"Item 13 wires the feed"* | `creator_posts` is described as "ready to feed". |

## Not recorded anywhere

**Items 14–21 have no entry in any document in this repo.** Known to belong somewhere in there,
from the rules doc, but never given a number:

- **Needs You (§24)** — the dependency/action system. Item 10's own gap-check prompt called it
  "Item 24", but that is the **rules section number, not a build item number** — there are only
  21 items. Its inputs are already wired: the four shoot moves are derived server-side on both
  sides, and `/brands/me/shoots` is built, gated and needs-you-ordered. It needs screens only.
- **The delayed-collaboration set (§25)** — item 10 sets the flag; moving a delayed collaboration
  into its own set was explicitly deferred.
- Also in the rules and not yet placed: dispute resolution (§26), follower discovery and the
  shopping/order path (§14–§16, §40), commission settlement and payouts (§17–§18), withdrawals
  with TDS and the minimum (the v1.22 §17 addition), admin surfaces beyond what each item added.

If you tell me items 14–21, I will write them into this file so the sequence stops living in your
head. Until then, treat rows 11–13 as the committed order and everything after as open.
