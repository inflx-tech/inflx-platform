# offer-delete — spec

**Delete a draft offer, and delete an offer once it has ended.** Brand website, Listings › Offers
and the offer page. Rules: `Docs/OFFER_TERMS_POSTS_RULES.md` **v1.17** §1.9, §1.12. Server, website,
one additive migration (201). No phone change, no OTA, no money.

## The founder's words (chat, 3 Oct 2026, with a screenshot of Listings › Offers)
> "Here i need delete button... in two places... one is in draft where i can able to delete the
> offer or edit offer if not in live... next place is when offer is created and when we ended that
> offer... then only we should get delete option for this"

## State before (verified in code 3 Oct 2026 — survey in `research/survey.md`)
- **Drafts:** the server has deleted drafts since 28 Sep (`DELETE /brands/me/offers/:id` →
  `offerLife.deleteDraft`, hard delete, drafts only, tested). The website's API helper exists
  (`brandApi.deleteOffer`) but **no button calls it** — the Offers table shows only "Continue".
  Abandoned drafts ("Untitled offer") pile up and cannot be removed.
- **Ended offers:** rule §1.9 (v1.0, 28 Sep, board O1 question 3) says *"A published offer can't be
  deleted, only ended, so sales history and creators' records stay intact."* The server refuses.
- **What points at an ended offer:** creators' signed terms (`collab_offers`, RESTRICT), their posts
  (`creator_posts.offer_id`, RESTRICT), order lines (`order_lines.offer_id` / `pool_item_id`, block),
  sale records (`follower_transactions.brand_offer_id`, SET NULL), the wallet's sales list, admin's
  posts and orders. A true erase fails on any offer a creator ever had, and would blank sale history.
  Shoppers already cannot see an ended offer. An ended offer can never come back to life.
- **"Ended"** is two stored states: `status='ended'` (End offer now) and `status='published'` with the
  end date passed. The list shows both as Ended (`offerRules.displayStatus`).
- **Editing:** a draft is fully editable (Continue → the builder). A Scheduled or Live offer is frozen
  (rule 1.10): only Add / Remove products while no creator has it, or End offer now.

## The rules now (v1.17)
| # | Rule |
|---|---|
| 1 | A **Draft** can be deleted from the Offers list. It is erased: a draft was never given, posted or sold. |
| 2 | An **Ended** offer — ended early with End offer now, or ended by its date — can be deleted, from the Offers list and from its own page. It is **removed from the brand's lists**; its record stays for the creators who had it, their posts, orders, payments and INFLX. |
| 3 | A **Scheduled** or **Live** offer cannot be deleted. End it first. |
| 4 | Editing is unchanged: drafts through Continue; a published offer's name, type, numbers and dates stay frozen (1.10). |

## Decisions (standing autonomy; each follows from the founder's words and the survey)
| # | Decision | Why |
|---|---|---|
| O1 | Draft: a **Delete** button beside **Continue** on the row; a confirm box; the draft is erased. | The founder's first place. The server already does it. |
| O2 | Ended: a **Delete** button beside **Open** on the row, and on the ended offer's own page (top right, where End offer now was). A confirm box. | The founder's second place. He ends an offer on its page, so that is where he will look for Delete next. |
| O3 | Deleting an ended offer **hides it from the brand**: a new column `brand_offers.deleted_at` (migration 201). It leaves the Offers list and its counts, its page answers "not found", and it is left out of the brand's other offer hints (creator terms' "not shown, ended" note; Products without offers' "last in offer …"). Everything a creator, shopper, order, wallet or INFLX admin reads is untouched. | The only version the database allows for offers creators had, and the one that keeps rule 1.9's reason (history intact). |
| O4 | An ended offer that **no creator ever had** is hidden the same way, not erased. | One behaviour for the brand; nothing to explain. |
| O5 | Deleting an ended offer also frees the past days its products were held, so a new offer whose start is back-dated is never refused naming an offer the brand deleted. Creators' views do not read those days. | A deleted offer must not reappear in a refusal. |
| O6 | Scheduled and Live rows get no Delete. A delete sent for one is refused: "End it first." | Founder: "when we ended that offer… then only". |
| O7 | The End offer now box said the offer "stays in your list as Ended"; it now says it stays in the list as Ended **until you delete it**. | The sentence must stay true. |
| O8 | Confirm wording — Draft: **Delete this draft?** · *"It isn't published, so no creator has it and no products are held. This can't be undone."* · [Keep it] [Delete draft]. Ended: **Delete "{name}"?** · *"It comes off your Offers list. Creators who had it, their posts, orders and payments keep their records."* · [Keep it] [Delete offer]. After: toast "Draft deleted." / "Offer deleted." | New words, plain. |
| O9 | The delete button uses the existing red-outline style (`btn btn-danger btn-sm`, as End offer now) and sits beside the row's own button on one line. | Matches the page; nothing new to learn. |
| O10 | No undo and no "Deleted" view in this change. INFLX keeps the rows. | Scope; can be added if wanted. |

## API (for the website builder)
`DELETE /v1/brands/me/offers/:id`
- Draft → erased → `200 { deleted: true, mode: 'erased' }`
- Ended (displayStatus) → hidden → `200 { deleted: true, mode: 'hidden' }`
- Scheduled / Live → `409 OFFER_LOCKED` "This offer is still running. End it first, then you can delete it."
- Already deleted / not the brand's / not found → `404 NOT_FOUND`
List rows keep `display_status`; the website shows Delete when it is `draft` or `ended`.

## Not in this change
Editing a Scheduled offer (rule 1.10 unchanged). Deleting a Scheduled or Live offer. A deleted-offers
view or undo. The brand phone app (it has no offers list; its terms sheet reads the server's filtered
hints). The shopper app.

## Supersedes
Rules v1.0 §1.9's "a published offer can't be deleted" for ended offers; board O1 question 3 of
`features/offer-builder-v2` (draft-only delete) for ended offers.
