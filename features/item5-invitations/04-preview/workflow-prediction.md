# item5-invitations — workflow prediction

Mockups: `mockups/item5-invitations-locked.html` (founder-locked 12 Sep 2026; I9 gained "Asked for
another date", I15 gained the Closed state after the gap report).

| Screen | Predicted | Built as |
|---|---|---|
| I1 Add creators | three tabs; search and filters as item 3; checkbox rows; "Can't invite" / "Not open to this set"; "Invited" ticked and locked; the hint; "Next: terms for {n} creators" | `BrandSetPickCreatorsScreen` + `DiscoverList` (new `pickState` prop) |
| I2 Invite a group | "{k} of {n} can be invited", the set line, the avatar stack, the cannot list with three labels, the hint, "Next: terms for {k} creators" | `BrandGroupInviteCheckScreen` |
| I3 Terms · Pay for Sale | locked set card; Commission with the minimum hint and amber box; What she can sell (three chips + picker + tags + Change); Follower offer row; Shoppable posts read-only; Use these terms for everyone; Next creator | `BrandCreatorTermsScreen` (goal = conversion) |
| I4 Terms · Pay for Content | Fee + the 25/25/50 hint; deliverables rows with ✕ and "Add another"; the note; usage rights switch, durations, places | same (goal = engagement) + `DeliverablesEditor5` |
| I5 Terms · Hybrid | Fixed fee with its hint; then everything from I3; no deliverables, no usage rights | same (goal = hybrid) |
| I6 Follower offer | three options; saved offers as radio rows with a one-line summary; preview box; Use this offer | `OfferSheet5` |
| I7 Special offer | three kinds; % / ₹ and amount; Applies to (hidden for BOGO); From / Until; Also save to my offers; preview; Use this offer | `SpecialOfferSheet5` + `ScopePickerSheet5` |
| I8 Review and send | "All {n} creators"; locked card with Replies close; the below-minimum line; rows with OK / Below min; the hint; Send {n} invitations; on failure the rows marked + "Remove {n} and send the rest" | `BrandReviewSendScreen` + `ReviewRow5` |
| I9 The set after sending | item 4's header; groups in the D6 order incl. "Asked for another date"; rows with meta; "Send agreement" / "Another set" chips; Add creators hidden after the cutoff | `BrandSetDetailScreen` + `GroupHeader5`, `SetCreatorRow5` |
| I10 One creator | ⋯ View terms sent · Open profile · Withdraw invitation · Remove from set; the withdraw confirm copy; the terms-can't-be-edited hint | `ActionSheet`, `ConfirmSheet`, `TermsSentSheet5` |
| I11 Creator · Invites | cards with brand, campaign · set, Aim / mode / Posts tags, "You earn …", "Reply by … · n days left" | `CollabsScreen` + `InvitationCard5` |
| I12 Creator · the invitation | "Set by the brand, same for everyone" then "Your terms"; the note in quotes; "Nothing is final…"; Accept / Counter / Decline | `InvitationScreen` |
| I13 Pay for Content invitation | Fee, "You post …", "Brand can reuse …", the tinted "How the fee is paid" card | same |
| I14 Accept and decline | the accept confirm; the decline sheet with five chips, the optional note, the hint, "Decline invitation" | `ConfirmSheet`, `DeclineSheet5` |
| I15 Every other state | Accepted / Expired / Withdrawn / Closed chips with their sentence; the empty state; Done after seven days | `InvitationCard5`, `CollabsScreen` |

Known departures, deliberate: "Some categories" picks **one** category (the row stores one category
node; several would need a new column and eight readers — flagged for the founder). The minimum hint
reads "{First}'s minimum is 12%." because the server does not name the category. Categories and
products come from the brand's published catalogue grouped by category node.
