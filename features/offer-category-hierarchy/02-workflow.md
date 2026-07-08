# Workflow — offer-category-hierarchy

1. Admin: Offers → New → Discount/Volume → Category scope.
2. Picker lists the FULL hierarchy as searchable full-path rows:
   "Men", "Men › Topwear", "Men › Topwear › T-Shirt", "Men › Bottomwear ›
   Jeans", … with the brand's product count per node.
3. Admin picks any node → stored as category_node_id (+ label chip).
4. Follower buys a product in that node's subtree → offer applies (checkout +
   cart preview + browse-card badge + PDP).
5. Picking "Men" applies to everything under Men; picking "Jeans" applies only
   to jeans.
6. Old string-category offers keep matching by section name.
7. Food/salon brands (no tree) still get the flat section picker.
