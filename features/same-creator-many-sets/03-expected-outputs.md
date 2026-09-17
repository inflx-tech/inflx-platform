# Expected outputs

`backend/tests/item4-campaigns-sets.test.js` — **check 22, rewritten**. It used to assert the
wrong rule; a passing test is not proof if it is guarding the wrong thing.

| # | Given | Expect |
|---|---|---|
| 1 | Asha LIVE (`invited`) in Set A → invite to Set B | **not 409.** 201, or 403 if her own invitation settings refuse — never the cross-set refusal |
| 2 | Asha LIVE (`invited`) in Set B → invite to Set B | **409** |
| 3 | Asha `declined` / `expired` / `deferred` / `rejected_by_brand` / `slots_filled` in Set A → invite to Set B | **not 409**, for each of the five |

Row 1 is new. Row 2 is new — the old test never checked the rule that survives. Row 3 is what
item 4 Q6 bought, kept intact.

## Regression

Full backend suite, before and after, diffed by test name:

```
BEFORE  221 failed / 1096 passed / 1317 total
AFTER   221 failed / 1096 passed / 1317 total
newly broken 0 · newly fixed 0 · 1 test replaced (check 22)
```

The 221 are the standing pre-existing failures. Two of them are in `campaigns.test.js`; I
stashed this change and confirmed both fail without it.
