# Expected outputs

| # | Assertion |
|---|---|
| C-1 | Inviting a creator with no coupon and no prefix **succeeds** |
| C-2 | An open-group commission set saves with no prefix |
| C-3 | A coupon passed for a creator is still used |
| C-4 | It is still checked for uniqueness — the column has a unique index |
| C-5 | A prefix on the set still generates one code per creator |
| C-6 | With neither, `coupon_code` is stored as NULL rather than throwing |
| C-7 | A content set is still refused a prefix |
| N-1 | Every read of `coupon_code` in the money path still tolerates NULL |
| N-2 | Nothing anywhere looks a creator **up** by coupon |
| N-3 | A sale with no coupon is still attributed — campaign, set, offer, creator |
