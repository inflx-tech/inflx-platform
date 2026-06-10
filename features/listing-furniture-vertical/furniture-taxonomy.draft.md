# Furniture Listing — Full Taxonomy (tree + facets) · DRAFT for review

> Drill-down vertical on the SAME engine as fashion. Seed = tree + per-leaf facets.
> Source: C:\WORK\furniture_listing_tree.draft.csv + furniture_facets.draft.csv
> (harvested from a Pepperfry dump). 8 families · ~50 item-types.

## Carried over from fashion (same engine)
- **One listing** (no Showcase/Sell) — CTAs come from the brand's enabled modes:
  **Buy / EMI** (online) · **Pay-at-store / Visit** · **Enquire / Request-Quote**
  (furniture skews enquiry + made-to-order, high-ticket low-frequency).
- **Multi-image + variant pics per Colour/Finish.**
- **Brand** (popular furniture brands + type-your-own) · **auto-SKU** per business.

## Furniture-specific structure
- **Top axis = FAMILY** (not gender). 8 families.
- **2-level drill: Family → Item-type** (item-type = the leaf where you batch-add).
  (Fashion was 3-level Segment→Category→Leaf; furniture is shallower.)
- **Room = a discovery facet** (multi-select), NEVER a tree node.
- **Subtypes are FACETS, never nodes** (3-seater, 2-door, LHS, Queen, Foam/Spring).
- **Variant axis varies per item** (Seater / Size / Doors / Seats / Config) — see below;
  many items have NO variant → single listing + Colour/Finish only.
- Furniture attributes: **Dimensions L×W×H**, **Weight capacity**, **Warranty**,
  **Made-to-order → Lead time**, **Assembly**, price = **"starting from" + Request-Quote**.

## SHARED facets (every furniture item)
| Facet | Type | Req | Notes |
|---|---|---|---|
| Images | image[] | ✅ | + per-Colour/Finish variant pics |
| Price | number ₹ | ✅ | "starting from"; per-variant price allowed; Request-Quote toggle |
| Material / Finish | select | ✅ | Solid Wood/Engineered Wood/MDF/Metal/Fabric/Leather/Cane/Glass/Marble |
| Colour / Tone | select | ✅ | Natural/Teak/Walnut/Oak/White/Black/Grey/Brown/Beige… (visual variant) |
| Brand | select | rec | popular + Own/Local + Other |
| Dimensions (L×W×H) | dimension | rec | required for large items |
| Room | multi-select | disc | Living/Bedroom/Dining/Study-Office/Kids/Outdoor/Entryway |
| Weight Capacity | number (kg) | opt | seating & beds |
| Warranty | text | opt | e.g. 1/3 years |
| Made to Order | boolean | opt | Yes → reveals **Lead Time** |
| Lead Time | text | cond | shown only if Made-to-Order = Yes |
| Assembly | select | opt | Pre-assembled / DIY / Carpenter-assisted |

## Variant axis (the "size" analogue — furniture varies a lot)
| Variant axis | Item-types |
|---|---|
| **Seater** (1/2/3/Set) | Sofa · Recliner |
| **Size** (Single/Double/Queen/King) | Bed · Mattress · Kids Bed |
| **Doors** (1/2/3/4/Sliding) | Wardrobe |
| **Seats** (2/4/6/8) | Dining Set |
| **Configuration** (LHS/RHS/Corner/U) | Sectional Sofa |
| **Size** (XL/XXL/XXXL) | Bean Bag |
| **No variant — single listing** | all Tables · Cabinets · Chests · Dressing · Bookshelf · Bedside · Office tables/cabinets · Outdoor · most Accessories (just Colour/Finish) |

---

# THE TREE — 8 Families → item-types (+ distinctive facets)

## 🛋️ Seating
- **Sofa** → *Seater [variant]* · Configuration (Straight/LHS/RHS/Corner/U) · Storage · Recliner
- **Sectional Sofa** → *Configuration [variant]*
- **Sofa-cum-bed** → Mechanism (Pull-out/Convertible)
- **Recliner** → *Seater [variant]* · Mechanism (Manual/Motorized)
- **Chaise Lounger**
- **Bean Bag** → *Size [variant]* · Filling (Filled/Cover only)
- **Accent / Arm Chair** → Style (Wing/Lounge/Slipper/Barrel/Rocking/Folding/Cafe)
- **Office Chair** → Type (Ergonomic/Executive/Mesh/Training/Guest/Cantilever)
- **Gaming Chair**
- **Dining Chair**
- **Bar Stool / Chair**
- **Bench / Settee**
- **Ottoman**
- **Stool / Pouffe**
- **Shoe Rack** → Type (Cabinet/Open/With-seat/Tilt-out)

## 🪟 Tables & Storage
- **Coffee / Centre Table** *(covers Coffee/Nesting/Tea)*
- **Side / Console Table** *(covers End/C-shaped/Console/Nest)*
- **TV & Media Unit** → Suitable TV size
- **Cabinet / Sideboard**
- **Bookshelf / Bookcase** → Tiers (2/3/4/5+)
- **Crockery Unit**
- **Chest of Drawers** → Drawers (2/3/4/5+)
- **Trunk**

## 🛏️ Beds & Bedroom
- **Bed** → *Size [variant]* · Storage (None/Box/Hydraulic/Drawer) · Type (Platform/Poster/Folding/Upholstered)
- **Bedside Table**
- **Wardrobe** → *Doors [variant]* · Mirror (Y/N)
- **Dressing Table** → Type (Dresser/With-cabinet/Wall-mounted)
- **Mattress** → *Size [variant]* · **Type** (Foam/Memory Foam/Spring/Latex/Coir/Hybrid) *(req)* · Feature (Orthopaedic/Cooling/Flippable) · Thickness · Firmness

## 🍽️ Dining & Bar
- **Dining Set** → *Seats [variant]* · Shape (Rectangular/Round/Square/Oval)
- **Dining Table** → Seats (2/4/6/8)
- **Bar Unit** → Type (Cabinet/Trolley/Table/Stool-set)

## 🧑‍💻 Study & Office
- **Study Table** → Type (Writing/Computer/Hutch/Foldable/Wall-mounted)
- **Office Table**
- **Office Cabinet**

## 🧸 Kids
- **Crib** → Convertible (Y/N)
- **Bunk Bed** → Configuration (Standard/L-shape/With-storage/With-study)
- **Kids Bed** → *Size [variant]*
- **Kids Study Table**
- **Kids Wardrobe**
- **Kids Storage**
- **Kids Seating**

## 🌿 Outdoor
- **Swing** → Type (Single/Double/Hanging/Floor-standing)
- **Outdoor Table**
- **Outdoor Seating** *(Chairs/Loungers/Sets)*
- **Lounger**

## 🧴 Accessories
- **Furniture Care Kit**
- **Massager / Massage Chair**
- **Pillow** → Type (Sleeping/Body/Pregnancy/Wedge)
- **Mattress Protector** → Size
- **Mattress Topper**
- **Cushion**

---

## Open for your review
1. **Family list** — 8 families above. Add/cut any? (e.g. split a "Home Decor" /
   "Furnishings" family, or fold Accessories differently?)
2. **2-level depth** (Family → Item-type) — good, or do any big families need a
   middle group (e.g. Seating → Sofas / Chairs / Stools)?
3. Any **missing item-types** your furniture sellers need (e.g. Temple/Pooja unit,
   Partition/Room-divider, Wall shelf, Garden planter)?
4. Confirm **Brand list** for furniture (Godrej Interio, Durian, Nilkamal, Royaloak,
   Sleepwell, Duroflex, Urban Ladder, Wakefit, Pepperfry… + Own/Local).
