# ui-walk-fixes — impact

**Production-impacting.** Both phone apps (OTA brand, OTA influencer) and a handful of small,
read-only server changes plus one server defect fix (Render, on push) — spec U6, U6c, U6d, U6e. **No migration. No money moves. No new app install.** The shopper app and the
website are not touched. Explicit go before the push and before each OTA.

## What changes for people
- **Brands:** must type a set name (no more silent "Set A"). Bottom tabs only on the five main pages.
  A creator who can't be invited says why (a rule reversal: until now the brand was never told).
  The next step on each creator's row is a labelled button; after sending an agreement they stay on
  it and read who is being waited for. Date and time are two boxes. Content opens inside the app.
- **Creators:** Accept / Counter / Decline are level, and Decline is quieter than Accept. A pasted
  link saves itself. Content opens inside the app. Cards say "Your move" when it is.
- **Both:** the box being typed in stays visible. Deliverables are one line each.
- **Data:** nothing stored differently. Collaborations in flight are unaffected.

## Surfaces touched (from `research/`, to be re-verified at build)
| Board | Phone files | Server |
|---|---|---|
| A | `BrandSetEditScreen`, `BrandCampaignNewScreen`, `BrandCampaignDetailScreen`, `campaigns/copy4` | — |
| B | `BrandSetPickCreatorsScreen`, `BrandGroupAddCreatorsScreen`, `BrandGroupInviteCheckScreen`, `discovery/DiscoverList` (new styles only), `invitations/copy5`, shared `Header` (optional second line) | `collabEligibility.service` (which rule failed), `invitations.controller` (short line + sentence) |
| all | `BrandNavigator` + `InfluencerNavigator` (tabs only on tab roots), shared `Header` and every tab root (status-bar inset, no blank strip) | — |
| C | shared footer strip (extend `create/bitsCreate` Footer), `settings/feedback` SaveBar (8 screens), ~14 screens with their own floating bar, shared `Sheet` (opt-in shrink/scroll), `tabScreenOptions` (both apps) | — |
| D | `invitations/bits5` DeliverablesEditor5 (five callers unchanged), `negotiation/sheets6`, `PitchFormScreen`, `PitchCounterScreen` | — |
| E | `settings/primitives` (opt-in pieces only), `InvitationScreen`, `ThreadScreen`, `BrandThreadScreen`, `PitchThreadScreen`, `BrandPitchScreen`, `agreement/sheets7`, `pitch/sheets8`, `BrandAgreementScreen`, `BrandWalletScreen`, `CollectionScreen` | — |
| F | `invitations/bits5`, `copy5`, `agreement/copy7`, `sheets7`, `BrandSetDetailScreen`, `BrandAgreementScreen`, `CollabsScreen`, pitch screens (two messages) | `invitationRows.service` (two lines), `agreement.service` (one line), `agreementCopy` (one sentence, kept identical to `copy7`) |
| G | `shoot/bits10` TimePicker10 (callers unchanged), new time-list file, `DateField` (additive props), `shoot/sheets10` | — |
| H | new viewer in `components/content`, the four content screens, a small shared player check (`shop/ShopVideo` re-exports it) | — |
| J | `content/bits12` (new link box), `ContentScreen`, `SaleLiveScreen`, `copy12`, `copy14` | — |

## Risk
- **Shared pieces.** The buttons are used on 260+ places, the sheet on 18 files, the list styles by
  the creator app's Find brands. Every change to a shared piece is additive and opt-in; nothing
  existing is restyled in place.
- **Jest cannot see layout.** Level buttons, the keypad and the tab bar are invisible to the test
  suite. The proof is a walk on a real phone, small and normal size, plus before/after shots.
- **Three native crashes have shipped from a name used without being imported.** New files and new
  imports are covered by `importsResolve` and `hooksBeforeReturns`; each new state gets a render test.
- **Video on a real phone is unproven in this project.** The device walk includes a large video and
  a 10 MB photo on both apps; older builds fall back to the browser.
- **Telling the brand why.** CORRECTED 2 Oct after the final review: her public "Open to" summary
  shows only her Aims and modes. That she does not take a brand's category, or does not visit a
  set's city, is NEWLY revealed by this change — one fact at a time, to the one brand it rules out;
  her full lists and her minimums are never sent. A brand could still work her lists out one at a
  time by changing its own category or the set's branch. A block still reads exactly like "paused";
  this is asserted on the server. Two sentences on her Invitation settings screen promised more
  privacy than this and are reworded (spec U22). Old phone bundles ignore the new fields.
- **Tabs and the strip** change every pushed screen of both apps at once. Jest cannot see either;
  the strip is built from the real status-bar inset so it cannot overlap the status bar.
- **The agreement server change** makes a withdrawn agreement sendable again from the set row. Older phone
  bundles read the corrected answer safely (they already draw a "Send agreement" row).
- **Tests that pin today's behaviour** (about fifteen assertions across item4/5/6/7 brand tests,
  shoot10, distance) are rewritten to the locked board and recorded as drift — none deleted.
- **Other window.** The tree is shared; stage by path; publish only from a clean phone tree.

## Order of release
1. Server push first — safe on its own; older phone bundles read every change safely. The app update
   must NOT go out before it: without `shoot.yourMove` a store-visit row shows no button.
2. OTA brand, then OTA influencer, one at a time, manifests read back.

## Rollback
Publish the previous OTA bundles; revert the server commit and push. No data to undo.
