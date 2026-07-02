# Workflow prediction (mockup)

`edit-product.html` shows the drill-down stepper in **edit mode** (Basics step):
the same form as add, pre-filled from an existing product, with the header reading
"Edit Fashion product", the category tabs / tree / bulk tabs hidden, and the primary
button reading **Save changes** (with a **Cancel** on the left).

Predicted behaviour:
- Reaching `/dashboard/products/listing?edit=<id>` loads the product into the
  stepper (leaf + facets + pre-filled draft) and renders the form immediately.
- Editing any field and pressing Save changes PATCHes the one product and returns to
  My listings; the row reflects the change.
- The Edit affordance appears on inventory rows in both browse paths.
