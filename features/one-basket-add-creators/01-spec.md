# One basket for Add creators

**Found:** founder, 2026-09-17 —
*"say i opened one one set…then i can able to add pool creators, from group and from list of
creators selected manually …but navigation to add creators is not actually supporting this."*

She is right, and it is not a glitch. It is two roads built at different times and never joined.

---

## 1. What is actually there

**Add creators** has four tabs: All creators · Worked with · Groups · Pool.

**Three of them fill one basket.** All creators, Worked with and Pool all tick into the same
screen-level selection, and the footer counts them together — *"Next: terms for 5 creators."*
Mixing those three already works today.

**The Groups tab is a different road.** Tapping a group does not tick anything; it **leaves the
screen** for the group-check page ("9 of 12 can be invited"). That page's Next calls
`startDraft` with the group's members **only**, which replaces the draft and discards everything
already picked. The footer is also hidden while the Groups tab is showing, so there is no visible
basket to add to — nothing on screen even hints that the five picks are still held.

Two doors. Walking through the second one closes the first, silently.

## 2. What changes

Two edits, both small.

1. **The footer shows on all four tabs.** The running total follows you onto Groups. It also
   grows a face row and a **Review** link, so the basket is something you can see and not only a
   number you have to remember.
2. **The group check adds to the basket instead of replacing it.** Same screen, same honest
   breakdown of who can't come and why — only the button changes, from
   *"Next: terms for 9 creators"* to **"Add 7 to selection"**, and it returns to the picker.

Then one **Next**, one terms flow, one **Send**, for pool + group + manual together.

## 3. One thing that has to move with it

Today the platform records "this batch came from group X" **once for the whole send**
(`sourceGroupId` on the draft, which decides `source = 'group' | 'brand_picker'` for everyone in
it). Once sources can be mixed, one label for the batch is a lie.

It becomes **per creator**. The good news is that the database was always shaped for this:
`campaign_influencers.source_group_id` is a per-row column. Only the request shape changes.
**No migration.**

## 4. What does not change

Who may be invited. Every existing refusal still applies, one creator at a time — her own
invitation settings, already live in this set, the group members the set can't take. The basket
changes how creators are *gathered*, never who is *allowed*.

## 5. Also drawn, and cuttable

**AFTER 5, the Review sheet** — what is in the basket, grouped by where each creator came from,
with a way to remove. It is a new screen. With twelve creators from three sources you need to
see and undo; without it the basket is a number you are asked to trust. But it is separable:
cut it and the other two edits still deliver what she asked for.

## 6. Classification

**Production-impacting.** Brand app + backend. One push, one brand OTA. No migration. The
creator app is untouched — she never sees any of this.
