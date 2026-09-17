# Expected outputs

| # | Expect | Where proved |
|---|---|---|
| 1 | Pay for Content with no formats is refused, in the brand's own words | `deliverables-model-aims.test.js` |
| 2 | **Hybrid with no formats is allowed** | same |
| 3 | A Hybrid set that names formats still gets those deliverables | same |
| 4 | Pay for Sale is unaffected | same |
| 5 | A Hybrid agreement with no formats countersigns: status active | `item7-agreement.test.js` |
| 6 | It locks the fixed money alone — ₹4,000, campaign fee ₹0 (v1.21 §9) | same |
| 7 | And releases the first 25% — ₹1,000 — into her wallet (v1.21 §10) | same |
| 8 | A refused signature shows the server's reason inside the sheet | `item7Brand.test.js` |
| 9 | And the sheet stays open so she can act on it | same |
| 10 | No regression at either end | both suites, measured by test name |
