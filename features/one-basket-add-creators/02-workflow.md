# Workflow

## Before

1. Set A → **Add creators**. All creators tab. Tick Priya, Sneha, Divya.
   Footer: *"Next: terms for 3 creators."*
2. Pool tab. Tick Meera, Anjali. Footer: *"Next: terms for 5 creators."* — still one basket.
3. **Groups tab.** The footer disappears. The five are still held in memory, but nothing says so.
4. Tap **Diwali shortlist** → the app leaves the picker for the group check.
5. *"9 of 12 can be invited."* Tap **Next: terms for 9 creators**.
6. `startDraft(setId, { creators: <the 9>, sourceGroupId })` — **replaces** the draft.
   The five are gone. No warning, no mention.
7. Nine invitations go out. To send the other five she must start the whole thing again.

## After

1–2. Unchanged. The footer now also shows three faces and a **Review** link.
3. **Groups tab — the footer stays**, reading *"5 selected."* Each group row gains a second line:
   *"12 creators · 9 can be invited"*, or *"5 creators · 2 already selected"*.
4. Tap **Diwali shortlist** → the same group check.
5. It now says **"Will be added · 9"**, and underneath, plainly:
   *"2 of them — Priya Sharma and Sneha N. — you had already picked. They will not be added
   twice."* The button reads **"Add 7 to selection"**, above the line
   *"5 already selected · 7 new from this group."*
6. Tap it → back to the picker, with a confirmation:
   *"7 added from Diwali shortlist. 2 were already in your selection."*
   Footer: *"Next: terms for 12 creators."* The group row now shows an **Added** chip.
7. One Next, one terms flow, one Send. Twelve invitations, each carrying the source it came from.

## The pieces that move

| | |
|---|---|
| `BrandSetPickCreatorsScreen` | footer rendered on all four tabs; basket face row + Review; `addMany(creators, groupId)` passed to the Groups tab; group rows show a per-set count |
| `BrandGroupInviteCheckScreen` | stops calling `startDraft`; calls `addMany` and `navigation.goBack()`; overlap counted and named; button copy |
| `draft5.js` | `sourceGroupId` moves from the draft to the creator |
| `BrandReviewSendScreen` | sends `creators[].sourceGroupId`; shows the source tag per row |
| `invitations.controller` | accepts a per-creator `sourceGroupId`, validates each against this brand, keeps the batch-level field working |

## The one real decision inside this

**Where does the overlap count come from?** The group-check endpoint already returns `can` and
`cannot` for the set. The overlap with the *basket* is known only on the phone. So the phone
counts it — no new endpoint, no extra wait.
