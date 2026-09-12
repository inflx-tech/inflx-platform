# item4-campaigns-sets — workflow prediction

Mockups: `mockups/item4-campaigns-sets-locked.html` (founder-locked 12 Sep 2026, counting clarified after
the gap report: the declined count on C1, C6 and C8).

| Screen | Predicted | Built as |
|---|---|---|
| C1 Campaigns tab | Live / Drafts / Past; New campaign; cards with chip, "{n} sets · next posting {d}", bar, "{i} invited · {s} signed · {w} waiting · {n} declined"; a draft shows "no invitations sent" and no bar | `BrandCampaignsScreen` + `CampaignCard4` |
| C2 Empty / loading / couldn't load | dashed empty box with the prompt copy; skeleton cards; "Couldn't load your campaigns" + Try again | same, `Skeleton`, `LoadErrorList` |
| C3 New campaign | name (counter to 60), description (hint), group banner when started from a group, "Next: add a set" → New set | `BrandCampaignNewScreen` |
| C4 New set | name + hint, three Aim options, two mode chips, branch row only for Store Visit (main first), every error under its field | `BrandSetEditScreen` + `BranchSheet4` |
| C5 Posting date picker | Monday-first month grid; days before today + 7 greyed and unpressable; the hint line; "Invitations would close …" as soon as a day is tapped; "Use this date" | `DateField` (confirm step + footer) |
| C6 Campaign detail | Created · chip · description; "Sets N", newest first; set cards with meta, dates, bar and counts or "No creators yet"; "Add another set"; "Show past sets (n)" | `BrandCampaignDetailScreen` + `SetCard4` |
| C7 Set detail · draft | rows; the draft lock line; Add creators ("Coming soon"); Edit / Duplicate; the empty box | `BrandSetDetailScreen` |
| C8 Set detail · live | "Invitations close in {n} days · {d}"; lock icon on every row; the live lock line; Creators N with bar and "waiting to answer"; Add creators / Duplicate | same |
| C9 States | "Date passed" chip + warning + Choose a new date; Expired chip + "Nobody signed by {d}" banner + Duplicate with a new date; Completed chip + "{n} collaborations" | `SetCard4` extras + `BrandSetDetailScreen` |
| C10 Duplicate | sheet with the prefilled "(copy)" name, the same picker, "Copied from …", the hint, Create set / Cancel | `DuplicateSheet4` |
| C11 Menus | campaign ⋯ Rename / Edit description / Delete (hidden once invitations exist); set ⋯ draft Edit / Duplicate / Delete, live Rename / Duplicate; the delete confirm copy | `ActionSheet`, `TextSheet4`, `ConfirmSheet` |

Known departures, deliberate: the Completed card omits "last one ended {date}" because no collaboration
carries an end timestamp yet (see the gap report §8); the delete-campaign menu item is hidden rather than
disabled when invitations exist (§6.8 allows either).
