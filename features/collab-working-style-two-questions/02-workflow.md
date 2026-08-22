# Workflow — the brand states a working style, the creator reads it back

## Golden path (item 1)

1. Brand opens a creator and taps **Ask to collaborate**.
2. Brand sets aim, money, time. Unchanged.
3. Brand reaches **WHERE THEY'D WORK** and taps **Remote**.
4. **ARE YOU SENDING HER PRODUCTS?** appears below it. Brand taps **Yes, we'll ship**.
5. Brand marks the whole working style a requirement or a preference. Unchanged — one
   marker covers both answers, because they are one term.
6. Brand sends. The request carries `terms.mode = "shipment"`.
7. Creator opens the request. She reads two lines: **Where you'd work — Remote** and
   **Products — They'll ship to you**.
8. She accepts. The agreement carries the same term.
9. The brand briefs it into a campaign; at contract time the working style is already
   answered (item 2).

## Branch — store visit

3a. Brand taps **Store visit**. The shipping question **does not appear**. Request carries
`terms.mode = "visit"`. Any shipping answer previously chosen is discarded, not carried.

## Branch — remote, nothing shipped

4a. Brand taps **No**. Request carries `terms.mode = "remote"`.

## Branch — not stated

3b. Brand leaves **Not stated**. No mode term, no importance marker, no shipping question.
Unchanged from today.

## Branch — brand changes its mind mid-form

Brand picks Remote + Yes, then switches to Store visit. The shipping answer resets so it
cannot be re-revealed with a stale value if they switch back to Remote.

## Reading back an existing shipping request

A request created before this change with `mode = "shipment"` reads back under the new
labels — **Remote** plus **They'll ship to you** — with no data change. The old single
phrase "They ship products" disappears everywhere.

## Expected end state

* The brand answered at most two questions and never a contradictory one.
* The creator can tell where she works and whether a parcel is coming, separately.
* The stored value is one of the same three the platform has always used.
* Nothing downstream of the handshake behaves differently.
