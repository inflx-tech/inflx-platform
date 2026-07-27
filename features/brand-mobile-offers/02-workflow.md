# Workflow — brand mobile offer builders (A7)
## Actor
Brand on mobile, Offer library.
## Steps
1. Tap **+ New offer** → pick a type: Discount · Volume · BOGO · Bundle.
2. **Volume** → choose tier basis (₹ spend or quantity), add tiers (threshold → % off).
3. **BOGO** → pick the product, set buy qty + free qty.
4. **Bundle** → pick 2+ products, set the bundle price.
5. Save as draft or Save & activate → the offer appears in the library.
## Success
- All four types can be created from the phone; configs are accepted by the API; no copy
  tells the brand to go to the web dashboard for these types.
## Failure/edge
- Invalid input (0 threshold, >100%, <2 bundle products) → clear message before posting.
- No products yet → picker says to add products on the web dashboard (listing IS web-only).
