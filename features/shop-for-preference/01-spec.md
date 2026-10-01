# shop-for-preference — spec

**The shopper's "I shop for" choice (Women / Men / Kids) orders her feed; it never hides a post.**
Rules: `Docs/OFFER_TERMS_POSTS_RULES.md` **v1.16** §5.12. Server only; the shopper app is unchanged.

## The founder's instruction (chat, 1 Oct 2026)
> "ask is for algorithm feed preference… we keep it for when we have large data for one customer…
> only men means if no posts available then show what exists, but after getting more data about
> customer then we first give priority to this."

## State before (verified on production, 1 Oct 2026)
- The feed, the Home circles and "more posts" left out every post whose category was not one she
  chose (Unisex and uncategorised posts always passed).
- The one live post on INFLX (KNTZXR) is a men's watch. A shopper who chose only Women or only Kids
  got an empty Home — no post, no creator circle, no brand circle — and "No posts yet".

## The rule now
- Every live post is in her feed, whatever she chose.
- Posts she shops for come **first**: her chosen groups, Unisex, and posts with no category. The
  rest follow. Inside each part the usual order applies (creators she follows, near her, newest;
  or the score, once the feed that learns is on).
- No choice made → no preference; the usual order alone.
- Home circles list every creator and brand with a live post. "More posts" under an opened post
  keeps its tiers (same creator, similar, everything else) and puts her preference first inside each.

## Decisions (standing autonomy)
| # | Decision | Why |
|---|---|---|
| P1 | "Priority" is read as: preferred posts first, always — not "only when there are none". | One rule that covers both of the founder's sentences: nothing is hidden, and her choice leads. |
| P2 | The same ordering in the rules feed (Stage A) and the feed that learns (Stage B). | Stage B is off; when it is switched on the choice still leads, and what it has learned orders within. Tuning that weight is a later decision, with data. |
| P3 | The Welcome and Profile screens keep their words ("I shop for"). | Nothing she reads is untrue: it shapes her feed. |

## Not in this change
The style choices (already a preference: a lift, never a filter); search (never filtered); a
"showing other posts" label; any phone change.
