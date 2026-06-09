# Fashion Listing — Full Taxonomy (tree + facets) · DRAFT v2 for review

> Drill-down vertical. Seed = this tree + per-leaf facets (NOT products).
> v2 (2026-06-09) folds in founder decisions: Plus-Size as a category, Accessories
> stays, Unisex as a tag, and Footwear/Jewellery/Watches/Sunglasses moved INTO fashion.

## Locked rules
- **One listing model — no Showcase/Sell mode.** Every product listed the same. Follower
  sees **Buy online** and/or **Pay at store** (walk in, pay via app for the offer/cashback)
  — only the button changes, per the shop's enabled modes.
- **Multi-image:** 1–6 photos, first = cover.
- **Size = variant axis** (per-size price/stock optional). **Color = required.**
- **Styles/subtypes are FACETS, not folders** (keep the tree shallow, still filterable).
- **Leaf = where facets attach** (variable depth, 2–3 levels).
- **Unisex = a discovery tag** (item lists once under its leaf; filterable as Unisex). No
  separate Unisex segment.
- **Plus Size = a category** under Women and Men (same leaves, plus-size values).
- **Footwear, Jewellery (imitation), Watches, Sunglasses, Bags, Accessories live INSIDE
  fashion** (gender-first). Real-gold jewellery still excluded (live-rate pricing).
- **No AI.**

---

## SHARED facets (every fashion leaf)
| Facet | Type | Role | Required | Values / notes |
|---|---|---|---|---|
| Images | image[] | — | ✅ (≥1) | 1–6, first = cover |
| Price | number ₹ | — | ✅ | + optional per-size price; Jewellery = fixed |
| Color / Tone | multi-select | variant* | ✅ | Black, White, Red, Blue, Navy, Green, Yellow, Pink, Purple, Orange, Brown, Beige/Nude, Grey, Maroon, Gold, Silver, Rose-Gold, Multicolor, Printed |
| Size | multi-select | **variant** | ✅ where sized | per **Size systems**; "Free Size" allowed |
| Brand | text/select | descriptive | optional | open + "Own/Local" |
| Unisex | boolean | discovery | optional | tag — surfaces under Unisex filter |
| Fabric / Material | single-select | descriptive | recommended | Cotton, Silk, Linen, Rayon, Georgette, Chiffon, Polyester, Denim, Wool, Velvet, Net, Satin, Blended, Khadi, Leather, PU, Canvas, Metal, Acetate |
| Pattern / Print | single-select | descriptive | optional | Solid, Printed, Checks, Stripes, Floral, Embroidered, Embellished, Colourblock, Graphic |
| Occasion | multi-select | discovery | optional | Casual, Daily, Office/Formal, Party, Festive, Wedding, Beach/Resort, Sports |
| Care | single-select | descriptive | optional | Machine wash, Hand wash, Dry clean |

\*Color is required + filterable; can pair with Size for a size×color SKU online.

## Size systems (variant axis — per leaf)
- **Alpha:** XS · S · M · L · XL · XXL · 3XL · 4XL  → tops, dresses, kurtas, t-shirts
- **Plus alpha:** XL · 2XL · 3XL · 4XL · 5XL · 6XL  → Plus-Size category
- **Waist (in):** 26 · 28 · 30 · 32 · 34 · 36 · 38 · 40 · 42 · 44  → jeans, trousers
- **Bra:** band 30–44 × cup A–E (e.g. 34B)
- **Free Size / One Size**  → sarees, dupattas, watches, sunglasses, most jewellery
- **Kids by Age:** 0–3m … 15–16y
- **Footwear (India = UK primary, EU shown alongside):** Women UK 2–9 (EU 35–42) · Men UK 5–12 (EU 39–47) · Kids UK/age (EU 19–37). India footwear retail uses UK as the de-facto size.
- **Ring:** 6–26 (Indian) / Adjustable  ·  **Bangle:** 2.4 · 2.6 · 2.8 · 2.10 / Free
- **Custom / Made-to-measure** (boutique stitching) — optional toggle

---

# SEGMENT 1 — WOMEN

## Category: Ethnic Wear
Saree · Kurta/Kurti · Kurta Set/Suit · Salwar/Churidar/Palazzo/Sharara · Lehenga Choli ·
Gown/Anarkali · Dupatta/Stole · Ethnic Blouse · Dress Material (unstitched) · Ethnic Jacket/Shrug
- Key facets: Fabric, Work (Zari/Embroidery/Print/Kundan/Bandhani), Occasion, Sleeve, Length,
  Neck, Pieces, Dupatta-included, Blouse-included. Saree/Dupatta = Free Size; others Size[V].

## Category: Western Wear
Top · T-Shirt · Shirt · Dress · Jumpsuit/Playsuit · Co-ord Set · Jeans · Trousers/Pants ·
Jeggings/Leggings · Skirt · Shorts · Sweatshirt/Hoodie · Sweater/Cardigan · Jacket/Blazer/Coat
- Key facets: Size[V], Fit, Sleeve, Neck, Length, Rise/Wash (denim), Style (Bodycon/A-line/…),
  Hooded, Pattern, Occasion.

## Category: Plus Size  *(NEW — Women)*
Plus Kurta/Kurti · Plus Saree-Blouse · Plus Top · Plus T-Shirt · Plus Dress · Plus Jeans ·
Plus Trousers/Leggings · Plus Nightwear · Plus Innerwear
- Same facets as the matching Western/Ethnic leaf, **Size = Plus alpha (XL–6XL)** or waist 38–48.

## Category: Innerwear & Sleepwear
Bra · Briefs/Panty · Lingerie Set · Camisole/Slip · Shapewear · Nightdress/Nighty ·
Pyjama/Lounge Set · Robe · Thermal Set
- Key facets: Size[V] (bra band×cup), Type, Wired, Coverage, Padded, Pieces, Fabric.

## Category: Activewear
Sports Bra · Sports Top · Tights/Leggings · Track Pants · Active Shorts · Active Co-ord
- Key facets: Size[V], Support level, Padded, Fabric (Dry-fit), Length.

## Category: Maternity
Maternity Dress · Feeding Kurta/Top · Maternity Bottom · Maternity Innerwear
- Key facets: Size[V], Feeding-access, Belly-support, Length.

## Category: Footwear  *(NEW — within fashion)*
Flats/Ballerinas · Heels · Wedges · Bellies · Sandals · Flip-Flops/Slippers · Sneakers/Casual ·
Sports Shoes · Boots · Juttis/Mojaris (ethnic)
- Facets: Size[V UK/EU women], Type, Material (Leather/PU/Canvas/Mesh/Suede), Closure
  (Slip-on/Lace/Buckle/Velcro), Heel height (heels), Sole, Occasion, Color.

## Category: Bags
Handbag · Sling/Crossbody · Clutch · Tote · Backpack · Wallet · Laptop Bag · Duffle/Travel
- Facets: Type, Material, Closure, Compartments, Color. Size = One Size.

## Category: Jewellery (imitation / fashion)  *(NEW — real gold excluded)*
Earrings · Necklace / Necklace Set · Jewellery Set · Bangles/Kada · Bracelet · Ring ·
Maang Tikka · Nose Pin · Anklet/Payal · Pendant/Chain · Mangalsutra · Brooch · Hair Jewellery
- Facets: Material/Plating (Gold-plated/Silver-oxidised/Brass/Alloy/Pearl/Beads), Work
  (Kundan/Polki/Meenakari/AD/Temple/Antique/Thread), Stone, Occasion, Color/Tone,
  Set (Y/N). Size = Free/Adjustable; Ring = ring size; Bangle = bangle size. **Fixed price.**

## Category: Watches  *(NEW)*
Watch (one leaf; Type = facet)
- Facets: Type (Analog/Digital/Analog-Digital/Smart), Strap (Leather/Metal/Silicone/Fabric/Chain),
  Dial shape (Round/Square/Rectangle), Dial color, Water-resistant, Occasion. Size = Free.

## Category: Sunglasses & Eyewear  *(NEW)*
Sunglasses · Eyeglass Frames
- Facets: Frame shape (Aviator/Wayfarer/Round/Cat-eye/Rectangle/Square/Sport/Oversized),
  Frame material (Metal/Acetate/TR90/Plastic), Lens color, UV-protection, Polarized. Size = Free.

## Category: Accessories
Belt · Cap/Hat · Scarf/Stole/Muffler · Socks · Gloves · Hair Accessories
- Facets: Type, Material, Color; Socks = Size[V] + length; rest Free Size.

---

# SEGMENT 2 — MEN

## Category: Topwear
T-Shirt · Shirt · Polo · Sweatshirt/Hoodie · Sweater/Cardigan · Jacket · Blazer/Suit · Vest
- Key facets: Size[V alpha/collar], Fit, Sleeve, Neck, Pattern, Type (Casual/Formal), Hooded, Pieces.

## Category: Bottomwear
Jeans · Trousers/Chinos · Track Pants/Joggers · Shorts · Cargos
- Key facets: Size[V waist], Fit, Type, Wash/Distress (denim), Length, Pockets.

## Category: Ethnic Wear
Kurta · Kurta Pyjama Set · Sherwani · Nehru/Ethnic Jacket · Dhoti/Lungi
- Key facets: Size[V], Pieces, Bottom type, Work, Occasion (Wedding).

## Category: Plus Size  *(NEW — Men)*
Plus T-Shirt · Plus Shirt · Plus Jeans · Plus Trousers · Plus Kurta · Plus Innerwear · Plus Nightwear
- Same facets as matching leaf, **Size = Plus alpha (XL–6XL)** / waist 40–50.

## Category: Innerwear & Sleepwear
Vest · Brief/Trunk/Boxer · Nightwear/Pyjama Set · Thermal Set · Loungewear
- Key facets: Size[V], Type, Pack size, Pieces, Fabric.

## Category: Activewear
Sports T-Shirt · Active Track Pants/Shorts · Track Suit
- Key facets: Size[V], Sleeve, Dry-fit, Pieces, Length.

## Category: Footwear  *(NEW)*
Formal Shoes · Casual Shoes · Sneakers · Sports Shoes · Loafers · Sandals · Flip-Flops/Sliders ·
Boots · Juttis/Mojaris (ethnic)
- Facets: Size[V UK/EU men], Type, Material, Closure, Sole, Occasion, Color.

## Category: Bags
Backpack · Laptop Bag · Sling/Messenger · Wallet · Duffle/Travel
- Facets: Type, Material, Compartments, Color. Size = One Size.

## Category: Jewellery (imitation)  *(NEW — limited)*
Chain · Bracelet · Ring · Kada · Stud/Earring · Pendant
- Facets: Material/Plating, Style (Oxidised/Antique/Minimal), Occasion, Color. Ring = ring size.

## Category: Watches  *(NEW)*
Watch — facets same as Women › Watches.

## Category: Sunglasses & Eyewear  *(NEW)*
Sunglasses · Eyeglass Frames — facets same as Women › Sunglasses.

## Category: Accessories
Belt · Wallet · Cap/Hat · Tie/Bow-tie/Pocket Square · Socks · Muffler/Scarf · Gloves
- Facets: Type, Material, Pattern, Color; Socks = Size[V].

---

# SEGMENT 3 — KIDS  *(size = Age)*

## Sub-segment: Boys (2–16y)
T-Shirt · Shirt · Jeans/Trousers · Shorts · Track/Co-ord Set · Ethnic (Kurta/Sherwani/Dhoti Set) ·
Innerwear · Winterwear · Nightwear
- Facets: Age[V], Sleeve, Neck, Fit, Type, Pieces, Occasion.

## Sub-segment: Girls (2–16y)
Dress/Frock · Top · Skirt · Jeans/Leggings · Ethnic Set/Lehenga · Co-ord/Track Set ·
Innerwear · Winterwear · Nightwear
- Facets: Age[V], Length, Style, Sleeve, Pieces, Occasion.

## Sub-segment: Infants (0–24m)
Bodysuit/Onesie · Romper/Jumpsuit · Clothing Set · Sleepsuit/Sleepwear
- Facets: Age[V], Sleeve, Pieces, Type.

## Category: Kids Footwear  *(NEW)*
School Shoes · Casual/Sneakers · Sandals · Flip-Flops · Booties (infant)
- Facets: Size[V kids/EU], Type, Closure (Velcro/Slip-on), Material, Color.

## Category: Kids Accessories
Caps · Socks · Bags/School Bag · Hair Accessories
- Facets: Type, Color; Socks = Age[V].

---

## Decisions — LOCKED 2026-06-09
1. **Plus Size** = a category under Women & Men (NOT a top segment, NOT just size values). ✅
2. **Accessories** stay inside fashion. ✅
3. **Unisex** = discovery tag/facet (no separate segment). ✅ (chat-architect best-decision)
4. **Footwear / Jewellery (imitation) / Watches / Sunglasses / Bags** = categories inside
   fashion, gender-first. Real-gold jewellery still excluded. ✅
5. Uniforms / costumes / fabric-by-meter — deferred (not now). ✅

## Decisions (cont.) — LOCKED 2026-06-09
6. **Footwear sizing = UK primary** (India standard), EU shown alongside. ✅
7. **Jewellery = imitation/fashion only**; `Plating / Base` is the one required facet
   (guardrail: real gold excluded). ✅
8. **Watches & Sunglasses** default `Unisex = Yes` (cross-gender). ✅ (chat-architect best-decision)

## Machine-readable seed (CSV-first — same pattern as furniture)
This master taxonomy is also emitted as the buildable seed, ready to become the
migration after lock:
- **Tree:** `features/listing-fashion-drilldown-upgrade/fashion_listing_tree.draft.csv`
  — `segment, category, leaf, size_system, variant_axis, unisex_default, notes` (≈165 leaves).
- **Facets:** `features/listing-fashion-drilldown-upgrade/fashion_facets.draft.csv`
  — `scope, facet_name, facet_role, input_type, required, allowed_values, show_if, notes`.

### size_system codes (used by the tree CSV)
`alpha` = XS–4XL · `plus_alpha` = XL–6XL · `waist_in` = 26–44 · `waist_plus` = 38–50 ·
`bra` = band 30–44 × cup A–E · `free_size` = One/Free · `one_size` = bags · `unstitched` = fabric set ·
`age` = 0–3m … 15–16y · `uk_women` = UK 2–9 · `uk_men` = UK 5–12 · `kids_shoe` = UK/EU kids ·
`ring` = 6–26/adjustable · `bangle` = 2.4–2.10/Free · `sock_size` = S/M/L/Free.

## Still to settle (next discussion — after you review)
- Tighten **allowed-value lists** where a category needs a narrower set than the broad ALL list.
- **Per-size stock/price UX** depth for online-Sell shops.
- Then: lock → seed migration (tables + this data) on the drill-down engine.
