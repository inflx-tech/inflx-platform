# creators-tab-shape — what was promised, what was built, what diverged

Written 2026-08-25, after implementation. Reads cold.

---

## 1. The founder's ask, in his words

> "we make brands creators tab UI/UX little flexible… first collabrations start in two ways
> pitches from creators and invitations from brand… next within invitation three ways
> finding individual, group and ask based on filters in bulk… brand can see both in two tabs
> that requests send by brand, pitches received… all conversations go talking and agreed one
> move to agreed tab… find creators screen need UI changes like filter should not be like
> that it should popup from bottom once try to filter list… on top search… also design which
> can handle all three types of ask from brand clearly… UI is not ok"

And on the shape, after seeing the boards:

> "keep sent, received under talking"

That last line settled the one real structural question. Five top-level tabs — Sent, Received,
Agreed, Find, Groups — truncate on a phone. Four tabs with a switch inside Talking do not.

---

## 2. The nine items, and what each one changed

| # | Before | After |
|---|---|---|
| 1 | Talking was one merged list. A brand could not tell what it had asked for from what had been offered to it. | Talking carries a **Sent / Received** switch with live counts. Each side keeps its own Your turn / Waiting / Closed grouping. |
| 2 | "Who can pitch you" sat under Profile, three taps from where pitches arrive. | It sits at the top of **Received** — the setting is beside the thing it governs. |
| 3 | Three permanently-open filter rows ate the top third of Find. | Search on top; active filters become **removable chips**. Nothing chosen, nothing shown. |
| 4 | Each filter opened its own page, and one was a page of its own. | **One bottom sheet** holds Where, Works in and Size. Choices are a draft until confirmed, so backing out changes nothing. |
| 5 | A separate full-screen Where picker. | **Retired.** File deleted, four navigator references removed. |
| 6 | "Request Collaboration" / "Ask this whole group" — neither said who. | **"Ask Priya"**, **"Ask Hyderabad Sarees · 6"**. The button names the person or the group and the number. |
| 7 | Ticking creators and pressing ask sent the **filters**, not the ticks. | Bar reads **Ask all N** with nothing ticked, **Ask N + Save as group** with ticks. The backend gained a fourth recipient mode so the ticks are what actually travels. |
| 8 | Empty lists said nothing, or said the same thing whatever the reason. | Received distinguishes **open to pitches** from **closed to pitches**. Sent, Agreed and Find each explain themselves. |
| 9 | An agreed row read "10%" and was ordered by when it was agreed. | Reads **"10% per sale · store visit"**, or **"₹8,000 · 2 reels · 1 story · remote, you ship"** — and the list is ordered **soonest-expiring first**. |

---

## 3. What diverged from the boards

**Nothing in shape.** Two things in detail:

1. **Item 9's "expired" state cannot appear.** The row renders `EXPIRED` at zero days, but the
   query behind Agreed carries `AND a.expires_at > now()` — an expired agreement is already
   gone from the list. The branch is harmless and left in place; it is noted here so nobody
   later reports it as a bug that never fires.
2. **Agreed shows terms only.** Selecting several agreed creators to brief them into one
   campaign is drawn on the boards and is **Stage 2**, recorded in `out_of_scope`.

---

## 4. Defects found while building this

| What was wrong | How it was found |
|---|---|
| **Ticking creators in Find sent the filters instead of the ticks.** Two people ticked, everyone matching the filter written to. | Item 7. The screen had no way to send a hand-picked set — the backend accepted only one creator, a group, or filters. |
| **`settled_terms_json` is not a column and never has been.** The Agreed row read `item.settled_terms_json \|\| item.terms_json`; the first half could never once have been truthy. | Checked the real table before trusting the field. Removed. |
| **Two creator-search screens existed**, the newer one's route reached only through a `target:` property. | Carried over from the previous contract; the retired Where picker was the last piece. |

The first is the same shape as four defects in the previous contract: **two things doing one
job, and only one of them getting the change.**

---

## 5. How it was verified

The local test database has been refusing connections since 22 August, so the backend change
was proved **against production directly**:

* `origin = 'picked'` — checked for a CHECK constraint (there is none), then **inserted a real
  row inside a transaction and rolled it back**. Accepted, with a generated batch id.
* Grepped for anything that branches on a request's `origin`. **Nothing does** — it is
  provenance, not control flow, so a new value cannot fall through a missing branch.
* Confirmed the Agreed query is `SELECT a.*`, so no field whitelist discards the terms.
* Read six real agreements out of production and ran the new line against their actual shape.

Mobile side:
* Android bundle builds.
* 113 mobile tests pass, 9 suites.
* **No duplicate route names inside any single stack** — checked per navigator, not per file,
  because the same name in two different stacks is legal and only a same-stack duplicate
  crashes natively.
* Every `navigate()` target in all five changed screens resolves to a screen that exists.
* No reference to the deleted picker remains anywhere.
* Style-token audit: no unknown tokens.

**Not done:** the full backend suite. It has not run since 22 August and this change does not
clear that debt. Certify no-regression on what was checked; do not read this as green.

---

## 6. What to check on the device

1. Talking → switch Sent / Received. Counts match the lists.
2. Received with pitches off — the empty state should say so, and offer the setting.
3. Find → tap filter → sheet rises from the bottom → back out → nothing changed.
4. Find → tick two creators → the bar reads **Ask 2** → send → **exactly those two** get it.
   This is the defect above; it is the single most important thing to walk.
5. Find → tick several → **Save as group** → the group appears in Groups.
6. A creator profile's button reads **Ask <her first name>**.
7. Agreed → the soonest-expiring row is first, and its line says what the deal actually is.
