# registration-and-profile — workflow prediction

Mockups: `mockups/registration-and-profile-mockups-v1.html` (C1–C8, B1–B9, A1–A3; locked 18 Sep
2026 by the founder's "Pls start implementation").

| Screen | Predicted | Built as |
|---|---|---|
| C1 Register step 1 | name, State picker, "Your nearest major city" picker filtered by state, helper line | `auth/InfluencerRegisterScreen` step 1 + `OfferedStateCityFields` (shared) |
| C1b City picker | plain list of that state's offered cities with search, count line | `components/registration/OfferedStateCityFields.js` (two `PickerSheet`s) |
| C2 Register step 2 | handles, unchanged | unchanged |
| C3 Pending home | Under review note, two browse cards, finish-profile sheet with reason | `components/shell/PendingHomeScreen.js` (kind creator) + `FinishProfileSheet` |
| C4 Profile main | status tag, "N things left", rows with red dots, Submit for review, no Payment & tax | `influencer/ProfileScreen` |
| C5 Profile info | photo, name, bio, State + city pickers, age, gender, email | `influencer/ProfileInfoScreen` |
| C6 Niche & languages | chips incl. Other + text box + honest note; 30 languages | `influencer/NicheLanguagesScreen` |
| C7 Wallet | balance card, Payment details: UPI / Bank account (number + IFSC) / PAN | `influencer/CreatorWalletScreen` + `influencer/PayoutDetailScreen` (one screen, three kinds) |
| C8 Rejected | admin remarks, the five registration fields pre-filled, Send for review again, Sign out | `auth/RejectedScreen` (creator branch) |
| B1 Register | seven fields, Fashion stated, city locked until state | `auth/BrandRegisterScreen` |
| B2 Pending home | Under review, locked tiles, finish-profile sheet | `PendingHomeScreen` (kind brand) |
| B2b Acting while pending | sheet with the server's words, Finish my profile / OK | `components/shell/PendingSheetHost.js` fed by `api.js` `ACCOUNT_PENDING` events |
| B3 Profile main | "N things left", Submit for review, GSTIN row gone | `brand/BrandProfileScreen` |
| B4 Business details | logo, name, about, contact person, email, phone (login, locked), type | `brand/BrandBusinessDetailsScreen` |
| B5 Branches | cards with four-part address, Main tag, Edit / Make main / Remove | `brand/BrandBranchesScreen` |
| B6 Add/edit branch | name, street, pincode, state, city | `brand/BrandBranchEditScreen` |
| B7 Second-branch question | sheet listing both, Save both | `brand/BrandBranchEditScreen` (`MainBranchSheet`) |
| B8 Wallet | balance, Business & payment details: GST number / Bank account | `brand/BrandWalletScreen` + `brand/BrandPayoutDetailScreen` |
| B9 Rejected | remarks, business name + four-part address pre-filled, Send for review again | `auth/RejectedScreen` (brand branch) |
| A1 Brand review | red "N things missing" card, the §6.2 rows, GST "not required" | `app/admin/brands/[id]/page.js` |
| A2 Creator review | same card, the creator rows incl. photo/bio/age/gender, Other flagged | `app/admin/influencers/[id]/page.js` |
| A3 Other queue | table Creator / She typed / Action; Map to… / Add as new niche | `app/admin/niches/other/page.js` |

Deliberate departures: the Waiting screen file is deleted rather than kept for the claim
variants — a claim conflict is admin's to see, and the pending home says "under review" either
way. The brand and creator wallets keep their existing balance cards; only the details section
below is new.
