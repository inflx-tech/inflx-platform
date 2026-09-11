# item2-pitch-invitation-settings — spec

**Item 2 of the brand + creator rebuild.** Rules doc `INFLX_Master_Business_Rules_Phase_1_v1.10.docx` §8A
(with §5, 8, 25, 27, 31). Locked mockups: `04-preview/mockups/item2-settings-locked.html` (B1–B8, C1–C6,
X1–X4). Build prompt: `PROMPT.md`. Founder approval + 17 answers: `APPROVAL.md`.
Phase 1 survey: `Docs/ITEM2_SETTINGS_GAP_REPORT.md`.

## What exists (before)

- A brand could switch pitches on/off and set five old filters (tier, niches, same city, engagement,
  past-collaborators) from the website. The switch defaulted to off; brands approved after 22 Aug were
  closed by accident; the filter values were handed to any creator who asked.
- A creator could set nothing. Nobody could block anybody. Invitations were never checked against the
  creator. Niches, languages, states and cities were typed arrays or free text; the 8 fashion
  sub-categories did not exist.

## What a person can do after

- **Brand → Profile → Pitch settings:** switch pitches on/off (with a confirm), choose the Aims and modes
  it accepts, and set private filters (niches, minimum Instagram/YouTube followers with either-is-enough,
  minimum engagement, languages, cities by state→city, always-allow past creators). See and unblock
  blocked creators. Block a creator from her profile.
- **Creator → My Profile → Invitation settings:** open/paused (with a confirm), Aims and modes, cities she
  can visit (only with Store Visit), brand categories (8), minimum fee per Aim and minimum commission per
  Aim and per industry. See and unblock blocked brands. Block a brand from its overview.
- **The other side** sees only paused/open, the accepted Aims and modes, and one of three reasons.
  Paused and blocked are indistinguishable. No threshold, list or minimum ever leaves the server.
- **On send**, the server refuses a pitch or an invitation that fails a hard rule and warns (never blocks)
  when an invitation's money is below the creator's minimum.
- **Two in-scope additions (founder):** a brand picks one or more of the 8 sub-categories at registration
  and in Business details (check 15); a creator must choose exactly one content niche to save her profile
  (check 16).

## Out of scope

Pitch flow (item 8), creator picker in a set + warning UI (item 5), admin UI, the 30-day pitch reply rule,
moving payout/tax to Wallet, the brand-web mirror of the settings screens.
