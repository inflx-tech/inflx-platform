# Workflow prediction

What I expect to be true when this is built, written **before** building it.

1. Ticking three on All creators, then landing on Groups, leaves a footer reading **"3 selected"**
   with three faces. Today that footer is not on screen at all.
2. Opening **Diwali shortlist** shows the same "9 of 12 can be invited" breakdown it shows today,
   with one sentence added naming the overlap, and a button reading **"Add 7 to selection"**.
3. Tapping it returns to the **Groups tab** — not to All creators, not forward to terms — with a
   confirmation naming the group and the count, and the footer at **12**.
4. The terms flow opens on the first of the twelve and walks all twelve. Nothing about it changes.
5. **Review and send** lists twelve, each with the source it came from, and the source is never
   part of what the creator receives.
6. After Send, `campaign_influencers` holds twelve rows for this set: seven with
   `source = 'group'` and the shortlist's id, five with `source = 'brand_picker'` and NULL.

If 3 lands on the wrong tab, or 6 stamps the group onto all twelve, the build is wrong even if
every screen looks right.

## Deliberately unchanged

- Who may be invited. Every refusal still runs per creator, server-side.
- The group is never shown to any creator.
- The over-50 confirmation.
- The creator's app.
