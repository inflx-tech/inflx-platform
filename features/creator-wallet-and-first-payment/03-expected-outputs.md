# Expected outputs

| # | Expect | Where proved |
|---|---|---|
| 1 | After the brand signs, the creator's Active card carries `firstPayment` equal to what was released | `backend/tests/item7-agreement.test.js` |
| 2 | That same card carries `hasUpfrontMoney: true` for a fee deal | same |
| 3 | A commission-only collaboration carries `hasUpfrontMoney: false` | same |
| 4 | The card says the released amount when there is one | `creatorWallet.test.js` |
| 5 | **The card never prints "₹0 is in your wallet" when the server sent no number** | same |
| 6 | A commission-only card says she earns as she sells, not zero | same |
| 7 | The wallet shows hers-now, still-to-come, earned, and each tranche's condition | same |
| 8 | An empty wallet explains how money will arrive | same |
| 9 | Commission on the way is shown with why it is not hers yet | same |
| 10 | No regression, either end | full suites, measured |

## Not proved here

That the second and third tranches release correctly — that is item 7's own ground and its tests,
and nothing here touches it.
