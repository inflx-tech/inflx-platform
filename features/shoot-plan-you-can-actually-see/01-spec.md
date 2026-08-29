# A shoot plan you can actually see

**Founder, 2026-08-29, with two screenshots:**

> *"Nothing I found what you said. I think still old one is showing in shoot area."*

He was right that it was still wrong, and wrong about why. Yesterday's fix landed — the shoot IS
a store visit now, and it IS in the planning state. **Four other things were hiding it.**

---

## 1 · Her screen said "You are live" on a visit she has to attend

Yesterday I gave a commission creator with nothing to deliver an honest headline. It read
`hasShoot = physical_delivery || data.production_event`.

**`production_event` was never in that payload.** So `hasShoot` was always false, and a creator
with a store visit to arrange was told she was live and shown no way to reach it.

Mine, from yesterday.

## 2 · The one button that opens the shoot has never had words on it

Stage 4 gave the shoot a hero action and wired it. **Nobody gave it a label.** The label map has
`accept · negotiate · pass · sign · deliverables · earnings` — and no `logistics`.

So since the day Stage 4 shipped, the button that opens the shoot has rendered as a **blank grey
rectangle**. It is visible in his screenshot as an empty box under "You are live".

⚠️ **A test has been asserting every hero action is WIRED since Stage 3.** Being wired and being
legible are different things, and it only ever asked the first.

## 3 · Both shoot screens threw the date window away

```js
setRange(dates?.data || null)      // the endpoint answers { range: { earliest, latest } }
```

One level too few. `range` came out as the wrapper — truthy, so the card drew — with `earliest`
and `latest` both undefined. Hence **"PICK ANY DAY BETWEEN [blank] and [blank]"**, on both
phones, identically.

## 4 · And for his campaign there is genuinely no day

Even unwrapped correctly, the window is **empty**:

| | |
|---|---|
| She must post by | **30 Aug** |
| A visit must finish 2 days before | **28 Aug** |
| Earliest bookable day is tomorrow | **30 Aug** |

Latest lands **before** earliest. No day satisfies both, and nothing said so.

A rule that cannot be satisfied has to announce itself — the fix is a human moving the posting
date, and only a person who is told can do that.

> **No day works** — *"The post is due too soon for a visit to fit before it. A visit has to
> finish two days before the posting date. Move the posting date back and the days will appear."*

## 5 · Why the diary still shows the old entries

His screenshot shows *"Mode set to remote · Remote mode auto-completed"*. That is **history, and
it is correct**. The event was repaired; the record of what happened to it is not rewritten. A
diary that edits its own past is worth nothing.

## 6 · Out of scope

* Changing the two-day buffer — it is a real rule and this makes it visible, not weaker
* Letting the brand edit the posting date from the shoot screen
