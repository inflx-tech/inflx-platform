# Workflow prediction (mockup)

`mrp-field.html` shows the Basics step with an optional **MRP ₹** input beside
**Price ₹**, and a Review snippet where the price renders with the MRP struck
through (e.g. `₹1,499  ₹̶1̶,̶9̶9̶9̶`).

Predicted behaviour:
- Entering an MRP higher than price surfaces the strike-through on Review and on the
  inventory row (existing `mrp > price` render).
- The same input appears in edit mode (shared form); clearing it removes the MRP.
- Excel template gains a matching optional MRP column.
