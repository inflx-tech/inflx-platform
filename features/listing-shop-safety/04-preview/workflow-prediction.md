# Workflow prediction — Listing and shop safety: four fixes

What people will see and do on the screens of `mockups/listing-shop-safety.html`.

**A1 · Listings · Hide and Show** — the same two buttons. Hide: the product stops being sold and
shown; creators' posts keep it but do not show it; a post with nothing else waits out of the shop.
Show: everything is back as it was. No dialog: there is nothing to lose.

**A2 · Listings · Remove** — the browser's own question now carries the facts: how many live posts
hold the product, how many of those have nothing else, that it cannot be undone, and that Hide is
the way to stop for a while. For a piece of a running or scheduled set the page shows a red line
and changes nothing.

**A3 · Listings · the product's offer panel** — "in N of their posts" is the real count.

**B1 · Edit product** — saving keeps the live stock of every box the brand did not touch, and moves
a changed box by the amount changed. When something sold or came back while the page was open, one
message says so after saving ("While you were editing, 2 of Blue · M were sold. Its stock is now
1."). Nothing moved: no message.

**C1 · Creator app · her post** — while shoppers cannot see a live post, a blue box at the top says
"Not in the shop right now" and why, and that it returns by itself. She gets a notice when a
product is paused and another when it is back.

**D1 · Shopper app · a set needing ×2** — one choice of colour and size puts both in; the chosen
line ends "×2".

**Not on any screen**
- Stock 0 saved by a brand is a pause (it used to remove the post for good).
- A set's post is in the shop only while every piece can be bought (unless pieces may be bought
  alone).
- Place order makes one order per attempt, however often it is tapped.

**What changes versus today**
| | Today | After |
|---|---|---|
| Hide a product | gone from every post for good | paused; Show restores |
| Save stock 0 | a post with nothing in stock is removed for good | it waits; restock restores |
| Remove a product | asks "Remove?" | asks with the number of posts; refused for a set's piece |
| Save Edit | stock back to what the page showed | live stock kept; only your change applied |
| Place order tapped twice | two orders, or blocked by her own hold | one order |
| A set with a piece missing | in the shop, cannot be bought | not in the shop until whole |

**Predicted questions**
- "I hid a product by mistake." → Show. Nothing was lost.
- "I want it gone from the posts." → Remove; the question tells you what it will do.
- "Why did my stock save as 8 when I typed 10?" → the message: 2 were sold while you were editing.
- "My post says Live but nobody sees it." → the blue box on the post says why.

**Blast radius** — the server's product hide / remove / edit paths, the shop's "is this post live"
rule, Place order; the website's Listings and Edit product pages; the shopper app's checkout and
deal page; the creator app's post page. One additive migration. No money path.
