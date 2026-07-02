# Workflow prediction (mockup)

`description-field.html` shows the Basics step of the drill-down add wizard with the
new optional **Description** textarea sitting under the price / stock / SKU row.

Predicted behaviour:
- Typing fills `draft.description`; it rides into the staged batch item as
  `description` and renders on the Review step under the name + price.
- Leaving it blank persists `null` (unchanged from today).
- The Excel bulk template gains a matching optional `Description` column so the two
  add paths stay in parity.
