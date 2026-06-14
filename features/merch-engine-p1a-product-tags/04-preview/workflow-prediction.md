# Workflow Prediction — Product Tags + admin tag-vocabulary

> Step 4. The predicted user path through the mockups, mapped to `02-workflow.md`.
> Reviewed at mockup-lock before any implementation.

## Mockups
- `mockups/admin-tag-vocabulary.html` — admin-web screen to manage the fixed tag list per business.
- `mockups/brand-listing-tag-step.html` — the new "Tags" step in the brand-web listing wizard.

## Predicted path
1. **Admin** opens **Tag Vocabulary**, scope tab = **Fashion** → types "Summer" → **+ Add tag** → row appears (Active). Repeats for Festive, Casual. *(workflow step 1)*
2. **Admin** switches scope to **★ All businesses** → adds "Trending" → it will appear in every business picker. *(step 2)*
3. **Brand** (Fashion) reaches the **Tags step** of the listing wizard → sees fixed chips **Summer · Festive · Casual · Trending** → taps **Summer** + **Casual** (turn gold) → types "beachwear" in *Your own tags* → **+ Add** (dashed free chip) → **Continue**. Product saves with `tags = {summer, casual, beachwear}`. *(step 3)*
4. **Brand** edits the product later → previously chosen chips are pre-selected → removes **Casual**, taps **Festive** → saves → `tags = {summer, festive, beachwear}`. *(step 4)*
5. **Admin** taps **Hide** on **Casual** → pill turns *Hidden*, it leaves the brand picker; a product already tagged `casual` keeps it. *(step 5)*

## Predicted observable end states
- Admin screen: vocabulary table reflects adds / hides; ★All tags shown across businesses.
- Brand wizard: selected (gold) fixed chips + dashed free chips; summary line lists final tags.
- Saved product carries the exact `tags` array; hiding a vocab tag never mutates a product.

## Palette / standard
INFLX gold/cream/white — gold = primary action (Add / Continue / selected chip), cream = info/summary surfaces, white cards, neutral lines. Free tags rendered with a dashed outline to distinguish from fixed vocab.
