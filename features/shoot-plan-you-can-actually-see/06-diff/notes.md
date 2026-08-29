# Before / after

**Reported, with two screenshots:** *"Nothing I found what you said. I think still old one is
showing in shoot area."*

He was right that it was still wrong and wrong about why. **Yesterday's fix did land** — the brand
screenshot says `STORE VISIT` and `No time suggested yet`, which is exactly the planning state it
was supposed to open in. Four other things were hiding it.

## Her screen

**Before** — *"You are live · Share your link and earn on every sale it brings"*, above **an empty
grey button**.

Two faults stacked:

* `hasShoot` read `data.production_event`, which **was never in that payload**, so it was always
  false and every creator with a shoot was told she was live. Mine, from the day before.
* The button's action had **no label**. `logistics` has never been in the label map — since Stage
  4 shipped, the one button that opens the shoot has been a blank rectangle.

**After** — *"The shoot"* with **Plan the shoot** written on it.

## The window

**Before** — `PICK ANY DAY BETWEEN` [blank] `and` [blank], on both phones.

`setRange(dates?.data)` where the endpoint answers `{ range: {...} }`. One level too few, so the
card drew with both dates undefined. The identical mistake in both screens.

**After** — the real dates. And where there are none:

> **No day works**
> *The post is due too soon for a visit to fit before it. A visit has to finish two days before
> the posting date. Move the posting date back and the days will appear.*

Which is his campaign: post due **30 Aug**, visit must finish **28 Aug**, earliest bookable
**30 Aug**. Latest before earliest. Verified by running the real service against his contract.

## The diary is not a bug

His screenshot shows *"Mode set to remote · Remote mode auto-completed"* still listed. That is
**history, and it is correct**. The event was repaired; the record of what happened to it is not
rewritten. A diary that edits its own past is worth nothing.

## Screenshots

His two are the "before". The "after" is the same two screens on his phone once v192 lands.
