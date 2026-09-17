# Impact

## Verdict

**A payload gap and a missing screen. No money logic is touched.** The platform had already paid
her; the app could not say so.

## What changes

| Layer | Change |
|---|---|
| Backend | `invitationRows.service.js` — two fields on the creator card, two columns carried through the query. No behaviour, no writes |
| Creator app | the card's three cases; a temporary `CreatorWalletScreen`; the Wallet tab stops being a placeholder |
| Payment engine | **nothing** |

## Risks

| Risk | Severity | Guard |
|---|---|---|
| The card invents a number again | **High** | It prints only what the server sent; a test pins that a missing value never becomes zero |
| A commission deal reads as a failed payment | Medium | `hasUpfrontMoney` splits them; tested both ways |
| The stand-in wallet is mistaken for the finished one | Medium | It says on screen that it is a simple view while the full wallet is designed |
| The extra columns slow the card query | Low | Two columns on a lateral that was already joined |

## Release classification

**Production-impacting.** One push (Render) and one OTA (influencer). No migration. The brand app
is unaffected.
