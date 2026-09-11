# INFLX — Item 3: Discovery, Profiles & Creator Groups

## Phase 1: gap identification (backend, database, frontend)

You are working in the INFLX codebase, which contains:

- the backend (Node, `backend/src/**`, with SQL migrations in `backend/migrations/**`);
- the Brand and Creator phone apps (`Packages/Mobile`);
- the brand website (`Packages/brand-web`) and admin, which share the same backend.

Three files come with this prompt:

1. **`INFLX_Master_Business_Rules_Phase_1_v1.11.docx`**: the business rules.
   - **Main sections for this item:** 5, **5A (Creator Groups, new)**, 8, 8A, 15 and 16A.
   - **Related sections:** 2, 13, 19, 27 and 31.
2. **`INFLX_Item3_Discovery_Mockups.html`**: the **locked** mockups. Open it in a browser. The screens are:
   - **A1–A9:** app shell and Profile tabs.
   - **D1–D5:** brand finds creators.
   - **G1–G10:** creator groups.
   - **P1–P4:** creator profile, as a brand sees it.
   - **F1–F3:** creator finds brands.
   - **O1–O4:** brand overview.
   - The table at the bottom of the file lists the data each screen needs.
3. **This prompt.**

**Order of authority:** rules doc → mockups → this prompt. If two of them disagree, stop and ask. Never guess.

> **This session is Phase 1 only.** Read and report. Do **not** change code, run migrations, or edit data. Write the gap report (§10), then **stop and wait for approval**. The build phases come after a separate approval message.

---

## 0. How to work

### 0.1 Read the real repo, not earlier reports

- **Item 2** (pitch and invitation settings) was built just before this item. Its gap report and the 2026-09-09 backend audit are useful guides, but the repo is the truth. Read what item 2 actually added: migrations, services, endpoints, components and screens.
- Cite **`file:line`** for every claim.

### 0.2 Grading

Grade every requirement with one status:

| Status | Meaning |
|---|---|
| **E** (Exists) | Works as required. |
| **P** (Partial) | Something exists but is incomplete. Say exactly what's missing. |
| **M** (Missing) | Nothing exists. |
| **C** (Conflicts) | Something exists but behaves differently from the rules or mockups, or would break if changed. |

When something was added by item 2, write **"(item 2)"** in the evidence.

### 0.3 Rules for your proposals

- **Migrations:** additive only. No dropping or renaming existing columns or tables. Check the next free migration number yourself; item 2 used 168 and 169.
- **Native code:** phone apps ship as over-the-air updates. Flag in the report any need for a **new native module** (for example an image picker, a maps SDK or a bottom-tab library with native parts). Report whether each one is already in the current app binary.
- **Server enforcement:** every rule in this prompt is enforced **on the server**. The apps also check, but the server is required.
- **Callers:** don't break existing callers. The brand website already calls some of the same endpoints (for example `GET /v1/influencers/:id` from `brand-web/app/dashboard/influencers/[id]/page.js`). List every caller of an endpoint you propose to change.
- **Tests:** record the current backend test failure count as a baseline. Earlier runs had about 231 failures that were already there.

### 0.4 Words: rules doc vs code

| Rules doc / mockups say | Code says (verify) |
|---|---|
| Creator | `influencer` |
| Aim: Pay for Sale / Pay for Content / Hybrid | `goal = 'conversion'` / `'engagement'` / `'hybrid'` |
| Mode of Work: Store Visit / Remote | `shoot_mode = 'visit'` / `'shipment'` |
| Pitch | `influencer_proposals` |
| Invitation (creator in a set) | `campaign_influencers` row |
| Agreement signed by both | `contracts.influencer_signed_at` **and** `contracts.brand_signed_at` both set |
| Brand sub-categories (the 8) | `brands.major_categories` (item 2) |
| Creator niche, languages | `influencers.niche`, `influencers.language`, with `ref_creator_niches` and `ref_languages` (item 2) |
| States and cities | `ref_states`, `ref_cities` (with `source` = `seed` or `google`) (item 2) |
| Branches | `brands.listing_data.branches[]` JSONB, with free-text city and state today |
| Instagram followers / YouTube subscribers / engagement | `influencers.followers_count` / `influencers.youtube_subscribers` / `influencers.engagement_rate` (Instagram only) |
| Products | listing engine tables (`is_active`, `pushed_to_store`, `variants_json` vs `product_variants`) |
| Shoppable posts | `creator_posts`, `post_media`, `post_products` |

---

## 1. Aim of this item

### 1.1 In one sentence

Item 3 builds the **front doors** of both apps. These are the screens where brands and creators find each other, see each other's profile, and keep their own profile up to date. Every later flow starts from one of them.

### 1.2 What it delivers

1. **App shell.**
   - Real bottom tabs:
     - **Brand app:** Home, Campaigns, Creators, Wallet, Profile.
     - **Creator app:** Home, Collabs, **+**, Wallet, Profile.
   - Tabs that come in later items show a "coming soon" screen.
   - The Profile tab in both apps becomes a **list of rows**. The screens behind the rows are rebuilt:
     - logo and photo upload;
     - brand About;
     - brand sub-categories;
     - branches using **Google address search**, where a city INFLX doesn't have yet is **added automatically**;
     - creator city through Google search;
     - required single niche;
     - read-only measured numbers.
2. **Brand finds creators** (Brand app → Creators tab):
   - **Discover:** search, filters, sort and a coarse status on each creator.
   - **Worked with:** creators the brand has signed with.
   - The full **creator profile**.
3. **Creator groups** (Brand app → Creators tab → Groups), rules doc §5A:
   - Private lists of creators. The brand creates, renames and deletes groups, and adds and removes creators.
   - A group is the starting point for "Invite to a set" (item 5) and "New campaign" (item 4). In this item those two buttons are placeholders. Everything else about groups works.
4. **Creator finds brands** (Creator app → Collabs → Pitch a brand):
   - **Find brands:** search, filters, sort and a coarse status on each brand.
   - The full **brand overview:** products, read-only product detail, the Brand Store posts area, branch cities and links.
   - The **brand's own view** of its overview, opened from Profile.

### 1.3 Why it matters later

These screens and services are **reused** by later items. Build them as components and services, not one-off screens:

- **Discover list:** item 5 uses it as the creator picker inside a set. Groups already use it now, in G5.
- **Creator profile:** items 5, 8 and later open it from invitations and pitches.
- **Brand overview:** item 8 starts pitches from it. Item 13 fills its Brand Store area with posts.
- **Groups:** items 4 and 5 read group members.
- **City auto-add:** every later address search uses the same service.

### 1.4 Out of scope for item 3

- The invitation flow and the bulk group check. G8 and G9 are built in item 5.
- Campaign creation. G10 is built in item 4.
- The pitch flow (item 8) and shoppable posts (item 13).
- Wallet, Home and the + tab contents.
- Share links. Offers in the phone apps (never shown).
- Admin screens.
- A groups feature on the brand website.

---

## 2. What the item contains: screen inventory

| ID | App | Where | Screen | Built in item 3? |
|---|---|---|---|---|
| — | Both | App root | Bottom tab bars | Yes |
| A1 | Brand | Profile tab | Profile list with header | Yes |
| A2 | Brand | Profile → Business details | Logo, name, About, contact, GSTIN, locked phone and major category | Yes |
| A3 | Brand | Profile → Sub-categories | 8 sub-categories, multi-select, plus reminder | Yes (control from item 2, moved here) |
| A4 | Brand | Profile → Branches | Branch list, main branch, edit, remove | Yes |
| A5 | Brand | Branches → Add/Edit branch | Google address search, city auto-add, main switch | Yes |
| A6 | Both | Home, Campaigns, Wallet, + | "Coming soon" pattern | Yes (placeholders) |
| A7 | Creator | Profile tab | My Profile list with header | Yes |
| A8 | Creator | Profile → Profile info | Photo, name, bio, Google city, handles, read-only numbers | Yes |
| A9 | Creator | Profile → Niche & languages | One niche required, languages multi-select | Yes |
| D1 | Brand | Creators → Discover | Search, quick filters, count, sort, creator cards | Yes |
| D2 | Brand | Discover → Filters sheet | All filters, live count | Yes |
| D3 | Brand | Discover | Statuses when "Open to invitations" is off | Yes |
| D4 | Brand | Discover (and every list) | Loading, no results, couldn't load | Yes |
| D5 | Brand | Creators → Worked with, Pitches | Worked with list; Pitches placeholder | Yes; Pitches → item 8 |
| G1 | Brand | Creators → Groups | Group list | Yes |
| G2 | Brand | Groups | Empty state; name errors | Yes |
| G3 | Brand | Groups → New group sheet | Create; rename uses the same sheet | Yes |
| G4 | Brand | Group detail | Actions and members with live status | Yes; the two action buttons are placeholders |
| G5 | Brand | Group → Add creators | Discover and Worked with as a multi-select picker | Yes |
| G6 | Brand | Add to group sheet | From a Discover card or creator profile | Yes |
| G7 | Brand | Group and member ⋯ menus | Rename, delete, view, remove, delete confirm | Yes |
| G8 | Brand | Invite group → pick set | — | **Item 5** (placeholder now) |
| G9 | Brand | Invite group → check result | — | **Item 5** |
| G10 | Brand | New campaign from group | — | **Item 4** (placeholder now) |
| P1 | Brand | Creator profile, top | Header, numbers, open-to card, groups line, actions | Yes; Invite → item 5 |
| P2 | Brand | Creator profile, scrolled | Collaborations with you; posts | Yes; posts → item 13 |
| P3 | Brand | Creator profile | Not open to your brand | Yes |
| P4 | Brand | Creator profile ⋯ | Open Instagram, open YouTube, Block | Yes (Block from item 2) |
| F1 | Creator | Collabs tab | Segments plus "Pitch a brand" card | Yes; segments → items 5–8 |
| F2 | Creator | Collabs → Find brands | Search, quick filters, count, sort, brand cards, statuses | Yes |
| F3 | Creator | Find brands → Filters sheet | Category, city, Aims, mode | Yes |
| O1 | Creator | Brand overview, top | Header, about, accepts card, Pitch, products | Yes; Pitch → item 8 |
| O2 | Creator | Brand overview, scrolled | Brand Store posts, branch cities, links | Yes; posts → item 13 |
| O3 | Creator | Product detail | Read-only product | Yes |
| O4 | Brand | Profile → Brand overview | Same page, brand's own view | Yes |

---

## 3. How item 3 links to everything else

Check every row. Say whether the dependency is **ready** and whether item 3's output is **shaped so the next item can use it**. Put the answers in §10, section 3 of the report.

| Link | Direction | What must be true |
|---|---|---|
| **Item 1: lifecycle** | Item 3 reads | P2 shows each collaboration's state as one of the seven state families (active, completed, ended…). P1 shows "N collaborations completed on INFLX". Report where collaboration state lives today and how it maps to the families. Report whether "completed" can be derived at all (the audit says `contracts` has no completed status). |
| **Item 2: settings and eligibility** | Item 3 reads | See the list below this table. |
| **Item 4: campaigns** | Item 3 feeds | Campaigns tab placeholder (A6). "New campaign" on a group (G4, G10) must later open campaign creation with the group as the starting creator list. The group-members endpoint must be usable from there. |
| **Item 5: invitations** | Item 3 feeds | See the list below this table. |
| **Item 8: pitches** | Item 3 feeds | Brand Creators → Pitches segment placeholder. Creator Collabs → Pitches segment placeholder. "Pitch this brand" button placeholder (O1). Find brands is the pitch entry point (rules doc §8: "Search Brand → Select Brand → Send Pitch"). |
| **Items 9 and 17: Wallet** | Placeholder | Wallet tabs are placeholders. Creator "Payment & tax" stays in My Profile (A7) until Wallet exists. |
| **Item 13: shoppable posts and Brand Store** | Item 3 feeds | "Posts on INFLX" (P2) and "Posts by creators · Brand Store" (O2) are empty placeholders now. Build them as grid components that item 13 feeds from `creator_posts`. Report what post data exists today. |
| **§16A: Shopper app stores and share links** | Awareness | The Brand Store in O2 is the same container the Shopper app shows (all posts made for the brand). No share links in item 3. |
| **Item 19: Home** | Placeholder | Home tabs are placeholders. Later, Home shows the 3–5 most recent pitches linking to Creators → Pitches. |
| **Brand website** | Shared data | See the list below this table. |
| **Admin** | Shared data | Only **approved** creators and brands appear in Discover and Find brands: report the approval flags. Niche, state and city lists are admin-managed later. Cities auto-added with `source = 'google'` must be distinguishable for later admin review. |
| **Listing engine** | Item 3 reads | See the list below this table. |
| **Social measurement** | Item 3 reads | Instagram followers, YouTube subscribers, Instagram engagement rate, and **when they were last measured** (A8, P1 "updated 9 Sep"). Report how and how often these are filled today, and whether a measured-at timestamp exists. |
| **Google Places** | Item 3 reads | Address search for branches (A5) and creator city (A8). Report the existing geocode and places proxy (`backend/src/routes/index.js` around lines 198–211), what it returns (place id, formatted address, city, state, pincode, lat/lng), keys, quotas and cost controls. |
| **File uploads** | Item 3 reads | Brand logo and creator photo: JPG or PNG, up to 5 MB. Report the existing upload flow (the audit mentions an `upload-url` endpoint for post media), storage and URL format, and whether an image picker is already in the app binary. |

**Item 2 (settings and eligibility) must provide:**

- The server-side eligibility service. Discover and group statuses use the **brand-level** part of `canBrandInviteCreator`: open or blocked, then category match. Find brands uses `pitchSummary` / `canCreatorPitchBrand` with the creator's profile only.
- `inviteSummary` on the creator profile and `pitchSummary` on the brand overview.
- Blocks, both directions.
- Reference lists: niches, languages, the 8 categories, states → cities.
- Components: `StateCityPicker`, `PickerSheet`, `Toast`.
- Theme tokens.
- The minimal `BrandCreatorProfileScreen` and `BrandOverviewScreen`. Item 3 **completes** these; it doesn't replace them.

Report what item 2 actually built for each.

**Item 5 (invitations) will reuse:**

- The Discover list as the creator picker inside a set, so the select mode (G5) must be part of the component.
- "Invite to a set" on P1 and G4 (placeholders now).
- G8–G9 run `canBrandInviteCreator` for **each member** of a group against a set, plus an "already invited to this set" check.

Report:

- whether the item 2 service can run for up to 100 creators in one request without N+1 queries;
- where "already invited to this set" would come from (`campaign_influencers`);
- the known bug "a creator can't be in a second set" from the audit, because group invites will hit it.

**Brand website:**

- Products and offers are managed on the website; the apps only read them.
- Registration sub-categories came from item 2.
- The website has an existing creator search and creator detail page. Report its endpoints so item 3 changes don't break it.
- Report any existing "shortlist", "saved", "favourite" or "list" feature on the website or in the database that overlaps with groups. Don't build groups on the website.

**Listing engine (brand overview products):**

- Published products at list price. Report what "published" means in code (`is_active`, `pushed_to_store`, approval).
- The first image, and all images for O3.
- The category path (for example "Women › Kurtas").
- Sizes and which are unavailable. The audit says there are two variant models (`variants_json` written by the website wizard, `product_variants` read at checkout). Report which to read.
- An **out-of-stock** rule. The audit says stock is never checked or decremented. Report what data could support an "Out of stock" label.
- The product count, used for the "Most products" sort.

---

## 4. Data requirements: what must exist

For each item, report status, evidence and a proposed change. Propose table and column names that follow the existing patterns.

### D1. Brand business details (A1, A2, O1)

| Field | Rule |
|---|---|
| Logo | Image URL. JPG or PNG, up to 5 MB, square crop in the app. Can be removed. |
| Brand name | Required. |
| About | Up to 200 characters. **Probably new.** Shown on the brand overview. |
| Contact person | Required. |
| GSTIN | Optional. **Never shown** to creators. |
| Phone | Read-only in the app, shown masked ("98••••••21"). |
| Major category | Read-only ("Fashion"). |
| Sub-categories | 1 or more of the 8 (item 2 column). Required. |
| Links | Website URL, Instagram handle. |

### D2. Branches (A4, A5, O2, and item 2 visit-city matching)

**Each branch needs:**

| Field | Rule |
|---|---|
| Branch name | Required. |
| Google place id | — |
| Formatted address | — |
| Pincode | — |
| Latitude and longitude | — |
| City | **`city_id` → `ref_cities`** |
| State | **`state_id` → `ref_states`** |
| Main flag | Exactly one per brand. |
| Timestamps | — |

**Rules:**

- A brand always has **exactly one** main branch.
- The main branch **can't be removed**. The brand can make another branch the main one.
- Removing a non-main branch asks for confirmation.
- Creators only ever see **city names**, never addresses.

**Report:**

- today's JSONB shape;
- every reader of `listing_data.branches` (shoot plan addresses, item 2 visit-city matching, the website, checkout or anything else);
- whether branches should move to a table or stay in JSONB with ids added;
- how existing free-text branches map to `ref_cities`, with a count of matched and unmatched rows.

### D3. City auto-add (A5, A8)

**When a Google result is picked:**

1. Find the state in `ref_states`.
2. Find the city in that state, matched on a normalised name.
3. If the city isn't there, **insert** it with `source = 'google'` and tell the user: "{City} is new on INFLX. We've added it to the city list."

**Constraints:**

- No duplicates, even when two users add the same city at the same moment (unique `(state_id, normalised name)`).
- The second brand adding the same city gets no toast.

**Report:** what happens if Google returns a **state** that isn't in `ref_states`. Propose an approach.

### D4. Creator profile (A7, A8, A9, P1)

| Field | Rule |
|---|---|
| Photo | JPG or PNG, up to 5 MB. |
| Full name | Required. |
| Bio | Up to 150 characters. |
| City | Required. Google search, stored as **`city_id`**. |
| Instagram handle | — |
| YouTube handle or URL | — |
| Niche | Exactly one, required (item 2). |
| Languages | Multi-select. |

Report existing validation of handles, and how existing free-text `users.city` / `influencers.city` values map to `ref_cities`.

### D5. Measured numbers (A8, D1, P1)

- Instagram followers, YouTube subscribers, Instagram engagement rate, and the date last measured.
- **Never editable by the creator.**
- Null means "not measured" and is shown as "—".

### D6. Creator groups (G1–G7), rules doc §5A

**Group fields:**

| Field | Rule |
|---|---|
| brand | Owner. |
| name | Required, trimmed, 1–40 characters, **unique per brand, case-insensitive**. |
| created_at | — |
| updated_at | Changes on rename **and** on any member added or removed. |

**Member fields:**

| Field | Rule |
|---|---|
| group | — |
| creator | Unique per group. |
| added_at | — |
| added_by | The brand user who added them. |

**Rules:**

- **Up to 100 creators per group.** No limit on the number of groups. A creator can be in any number of a brand's groups.
- **Only approved creators** can be added, whatever their invitation settings.
- Deleting a group deletes its member rows. It **never** touches `campaign_influencers`, `contracts`, `influencer_proposals` or anything else.
- A creator whose account is removed from INFLX **drops out of every group**. Report how account removal works today (soft or hard delete) and propose how.
- **Private to the brand:** visible to all of that brand's users and to no one else. Report whether a brand can have several user logins today.
- Report any existing table that already does something similar (shortlists, saved creators, campaign shortlists).

### D7. Worked with (D5, G5 tab)

Per brand, list the creators with **at least one contract signed by both sides**, with:

- the number of such collaborations;
- the date of the latest signature (the later of the two signature dates).

Sort newest first. An agreed but unsigned handshake does not count.

### D8. Collaborations with this brand (P2)

For the viewing brand only, list each collaboration with the creator:

- campaign name and set name;
- Aim;
- signed date;
- state, mapped to a state family.

Also the number of **completed collaborations across all brands** (P1). Propose a definition of "completed" that uses the rules doc §19 and the existing data.

### D9. Brand overview data (O1, O2, O4, F2)

- About, sub-categories, main branch city, branch count, list of unique branch cities, links.
- Published product count, and products in pages of 20: first image, name, list price, out-of-stock flag.
- **Never returned:** full addresses, phone, email, GSTIN, contact person, offers.

### D10. Product detail (O3)

- All images, name, brand, category path, list price.
- Sizes, each with an available or unavailable flag.
- Description.
- **Published products only.** An unpublished or foreign product id returns not found.

### D11. Approval and visibility

Report the flags that mean "approved and active" for creators and for brands. Discover, Find brands, profiles and group adds use them.

### D12. Search and performance

- Discover and Find brands filter and sort over the whole approved population, with pages of 20 and a live count.
- Report existing views or indexes (for example `v_searchable_creators`, `discover-brands`).
- Report how the **per-row status** (item 2 eligibility) can be computed **in SQL for a whole page**, not creator by creator.
- Same for the "N open to invitations" count on each group card (G1) and group detail (G4).

---

## 5. API requirements

Follow the existing route naming. For each endpoint, report whether it exists, is partial or is missing, and propose request and response shapes and error codes.

| ID | Endpoint (purpose) | Screens |
|---|---|---|
| A1 | Brand profile: GET/PUT business details and sub-categories. Logo upload (get upload URL → upload → save URL; remove). | A1, A2, A3 |
| A2 | Branches: list, create, update, remove, make main. Takes a Google place id, resolves address, city and state server-side, auto-adds the city (D3), and returns `cityAdded: true` when a city was added. | A4, A5 |
| A3 | Places: autocomplete and details proxy (existing, extended if needed). Used by A2 and A4. | A5, A8 |
| A4 | Creator profile info: GET/PUT (photo, name, bio, city from place id with auto-add, handles). Niche and languages PUT (item 2 validation). | A7, A8, A9 |
| A5 | **Discover creators** (brand only): see the details below this table. | D1–D4, G5 |
| A6 | **Creator profile for a brand** (extends item 2): see the details below this table. | P1–P4 |
| A7 | **Worked with** (brand only): creators, collaboration count and last signed date, newest first. Paginated. Accepts `search` for G5. | D5, G5 |
| A8 | **Groups** (brand only; every call checks the group belongs to the signed-in brand, otherwise 404): see the details below this table. | G1–G7 |
| A9 | **Find brands** (creator only): see the details below this table. | F2, F3 |
| A10 | **Brand overview** (extends item 2's `GET /v1/brands/:id/public`): D9 fields plus `pitchSummary`. **Remove full addresses** from the response (the item 2 report found this leak). When the viewer is the brand itself, return the same data plus `isOwner: true`. | O1, O2, O4 |
| A11 | Brand products: list (paginated, published only) and product detail (D10). | O1, O3 |
| A12 | Posts placeholders: creator posts for P2 and Brand Store posts for O2. Report what exists; an empty-list shape is fine now. | P2, O2 |
| A13 | Reference lists (item 2): confirm they cover niches, languages, categories, states and cities. | A3, A9, D2, F3 |

**A5 · Discover creators (brand only)**

- **Query:** `search`, `openOnly` (default true), `nicheCodes[]`, `minInstagram`, `minYoutube`, `minEngagement`, `cityIds[]`, `languageCodes[]`, `aims[]`, `modes[]`, `sort` (`followers` | `engagement` | `newest`), `page`.
- **Response:** `total` plus rows. Each row has: id, name, avatar, niche label, city name, languages, Instagram, YouTube, engagement, accepted Aims, accepted modes, and `status` (`OK` | `NOT_ACCEPTING` | `NOT_MATCHING`).
- **Group ids:** `groupIds[]` for the viewing brand's groups (for G6 ticks), or a separate call.
- **Count only:** a count-only mode or endpoint for the live "Show N creators" button.

**A6 · Creator profile for a brand (extends item 2)**

- Adds: bio, handles, measured-at date, completed collaborations count, collaborations with this brand (D8), and the names of this brand's groups the creator is in.
- **Never returns:** email, phone, or any private setting. Report what `GET /v1/influencers/:id` returns today and who else calls it.

**A8 · Groups (brand only)**

- **List:** name, member count, open-to-invitations count, updated_at or created_at, the first 4 member avatars. Sorted by recently updated.
- **Create** and **rename:** name validation (§7).
- **Delete.**
- **Detail:** header counts, plus members in pages. Each member has niche, city, Instagram and `status`, newest added first.
- **Add members:** bulk, idempotent. Skips creators already in the group. Enforces the cap of 100 and returns how many were added.
- **Remove member.**
- **Groups for one creator:** which of this brand's groups contain them (G6).
- **Set one creator's groups:** takes a list of group ids and applies adds and removes in one transaction (G6 Save).

**A9 · Find brands (creator only)**

- **Query:** `search`, `canPitchOnly` (default true), `categoryCodes[]`, `cityIds[]` (the brand has a branch in any of them), `aims[]`, `modes[]`, `sort` (`newest` | `az` | `products`), `page`.
- **Response:** `total` plus rows. Each row has: id, logo, name, sub-categories, main city, accepted Aims, accepted modes, and `status` (`OK` | `NOT_ACCEPTING` | `NOT_MATCHING`).
- A count-only mode for "Show N brands".

### Privacy rules (every endpoint above)

1. A brand viewer never receives a creator's private settings: visit cities, categories, minimum fee, minimum commission, blocked list. It also never receives the creator's email or phone.
2. A creator viewer never receives a brand's pitch thresholds (niches, followers, engagement, languages, cities), full branch addresses, phone, email, GSTIN, contact person or offers.
3. **Status reasons are coarse only:** `OK`, `NOT_ACCEPTING`, `NOT_MATCHING`. A block always looks exactly like "paused" (`NOT_ACCEPTING`).
4. **Groups are invisible to creators.** No creator-facing response, notification, email or log shown to creators ever mentions a group or group name.
5. Group endpoints return **404** for another brand's group, never 403 (so group ids can't be probed).

---

## 6. Business rules for item 3

### 6.1 Bottom tabs and placeholders (A6)

**Tabs:**

- **Brand:** Home, Campaigns, Creators, Wallet, Profile.
- **Creator:** Home, Collabs, + (large centre button), Wallet, Profile.

**Placeholder screens.** Each placeholder has a title, one line saying what the tab will do, and a button to something that works today:

| Tab | Title | Body | Button |
|---|---|---|---|
| Brand Campaigns (as mocked) | "Campaigns are coming soon" | "You'll create campaigns and sets here. Meanwhile, explore creators and set up your profile." | **Explore creators** |
| Brand Home | "Home is coming soon" | "Your to-dos across campaigns and creators will show here." | **Explore creators** |
| Brand Wallet | "Wallet is coming soon" | "Funds, payments and sales settlements will show here." | **Explore creators** |
| Creator Home | "Home is coming soon" | "Your to-dos and new invitations will show here." | **Find brands** |
| Creator + | "Shoppable posts are coming soon" | "You'll create posts that link to products here." | **Find brands** |
| Creator Wallet | "Wallet is coming soon" | "Your earnings and payouts will show here. Payment & tax details are in Profile for now." | **Open Payment & tax** |

### 6.2 Discover (D1–D4)

**Who appears**

- Only approved, active creators.
- **"Open to invitations"** is on by default and shows only creators whose brand-level status is `OK`.
- When it is off, every approved creator shows. Anyone not `OK` shows a status chip instead of their open-to tags.

**Brand-level status (no set involved), in this order:**

1. The creator is paused, **or** the creator has blocked this brand → `NOT_ACCEPTING` → chip "Not taking invitations".
2. The creator picked brand categories **and** none of the brand's sub-categories is in them → `NOT_MATCHING` → chip "Not open to your brand". A brand with no sub-categories set doesn't match a creator who picked categories (item 2, Q5c).
3. Otherwise `OK`.

Set-level checks (Aim, mode, visit cities, minimums) happen only in item 5.

**Search:** case-insensitive; matches the name or the Instagram or YouTube handle, with or without "@".

**Filters.** Filters combine with AND. Multi-selects inside one filter combine with OR.

| Filter | Rule |
|---|---|
| Niche | The creator's niche is one of those selected. |
| Instagram followers | Any / 1K+ / 10K+ / 50K+ / 100K+. |
| YouTube subscribers | Any / 1K+ / 10K+ / 50K+ / 100K+. |
| Engagement | Any / 2%+ / 4%+ / 6%+ (Instagram rate). A creator who hasn't been measured fails every filter other than Any. |
| City | The creator's profile city is one of those selected (state → city picker). |
| Language | At least one shared language. |
| Open to Aims | The creator accepts at least one of the selected Aims (public data). |
| Mode of work | The creator accepts at least one of the selected modes (public data). |

**Filter behaviour:**

- The button reads "Filters · N", where N is the number of filters changed from default.
- A quick chip shows "{first} +{n}" with ✕ to clear.
- **Clear all** returns to the defaults (only "Open to invitations" on).
- The sheet button shows the live count: "Show {N} creators".

**Sort:**

| Sort | Rule |
|---|---|
| **Most followers** (default) | The higher of Instagram followers and YouTube subscribers (confirm in questions). |
| **Highest engagement** | Measured creators first. |
| **Newest** | Newest approval first. |

**Paging:** pages of 20, infinite scroll.

**Card:**

- Avatar, name, "{Niche} · {City} · {Languages}".
- Three stats: Instagram, YouTube, Engagement. Numbers are formatted as 48.2K, 4.2%, and "—" when not measured.
- The creator's accepted Aim and mode tags ("Store Visit" has a pin), or the status chip.
- A **person-plus** button → G6.
- Tapping the card opens the creator profile.

### 6.3 Worked with (D5)

- Rules D7.
- **Row:** avatar, name, "{N} collaborations · last signed {d Mon}", or "1 collaboration · signed {d Mon}". Tap opens the profile.
- **Empty:** "No creators yet" / "Creators appear here once you both sign an agreement."
- **Pitches segment:** "Pitches are coming soon" / "Creators will be able to pitch you here." (until item 8).

### 6.4 Creator profile, as a brand sees it (P1–P4)

**Header and details:**

- Header: photo, name, "{City}, {State}".
- Tags: niche and languages.
- Three stats, then "Measured by INFLX · updated {d Mon}".
- Bio.
- Handles as tags that open the Instagram or YouTube app.

**"Open to invitations for" card:**

- Aim and mode tags (item 2).
- "{N} collaborations completed on INFLX". Hidden when N is 0.

**Groups and actions:**

- "In your groups: {Group}, {Group}". Shown only when the creator is in at least one of this brand's groups.
- Buttons:
  - **Invite to a set** (primary). A placeholder until item 5: tapping shows the toast "Inviting creators comes with campaigns. Coming soon."
  - **Add to group** (secondary) → G6.

**When the creator isn't open:**

- **`NOT_ACCEPTING`:** the item 2 banner: "Not taking invitations right now" / "You can still view {first name}'s posts." Invite is disabled.
- **`NOT_MATCHING`** (P3): banner "Not open to your brand" / "{First name} isn't taking invitations from brands like yours right now." Invite is disabled. The reason is never shown.

**Scrolled (P2):**

- **"Collaborations with you {N}":** one card per collaboration, "{Campaign} · {Set}", state chip, "{Aim} · signed {d Mon}". The section is hidden when N is 0.
- **"Posts on INFLX {N}":** empty state "No posts yet" / "{First name}'s shoppable posts will show here." (until item 13).

**⋯ menu (P4):**

- **Open Instagram** (only if there's a handle).
- **Open YouTube** (only if there's a handle).
- **Block {Name}** (red, uses the item 2 confirm sheet).
- **Cancel.**

**Never shown:** phone or email.

### 6.5 Creator groups (G1–G7), rules doc §5A

**Where groups live and what they show**

- **Location:** Creators tab → **Groups** segment (Discover · Groups · Pitches · Worked with).
- **List (G1):**
  - A **New group** button at the top.
  - "{N} groups", sorted by "Recently updated".
  - Each card shows: name; "{N} creators · updated {today | d Mon}", or "created {d Mon}" if never changed; up to 4 avatars plus "+N"; "{N} open to invitations", or "No creators yet" when empty.
- **Empty (G2):** "No groups yet" / "Save creators you like into groups, then invite a whole group to a set in one go." / **New group**.
- **Create (G3):** a sheet titled "New group".
  - Field "Group name *" with a "{n} / 40" counter.
  - Hint: "Only your brand sees group names. Creators are never told they're in a group."
  - Buttons: **Create group** / **Cancel**.
  - After Create, the new group opens with **Add creators** ready.
  - **Rename** uses the same sheet: title "Rename group", button **Save**.

**Group detail (G4)**

- **Header:** the group name and ⋯, then "{N} creators · {M} open to invitations · updated {…}".
- **Buttons:**
  - **Invite to a set** (primary; placeholder until item 5, toast "Inviting a group to a set comes with campaigns. Coming soon.").
  - **New campaign** (secondary; placeholder until item 4, toast "Starting a campaign from a group comes with campaigns. Coming soon.").
  - **Add creators** (secondary).
- **Members:** newest added first. Each row shows avatar, name, "{Niche} · {City} · {Instagram} IG", a status chip under it (**Open** green, **Not taking invitations** grey, **Not open to your brand** red), and ⋯. Tapping a row opens the profile.
- **Empty group:** "No creators in this group yet" / "Add creators from Discover or Worked with." / **Add creators**.

**Adding creators from a group (G5)**

- **Header:** "Add creators" with ✕, and "Adding to **{Group}** · {N} creators".
- **Tabs:** **All creators** (the Discover list with the same search and filters; "Open to invitations" defaults to **off** here) and **Worked with**.
- **Rows:** checkbox, avatar, name, meta, status chip under the meta.
- Creators already in the group are ticked, greyed, and show "Already in this group".
- **Capacity:** once the selection fills the group, other rows can't be ticked, and a hint shows "{Group} can take {k} more creators."
- **Sticky button:** "Add {N} creators", disabled when N is 0. After adding, the group detail shows toast "Added {N} creators to {Group}."

**Add to group sheet (G6)**

- Opened from the Discover card's person-plus or the profile's **Add to group**.
- **Title:** "Add {Name} to groups".
- **Rows:** checkbox, group name, "{N} creators", plus "· already in" where it applies.
- **New group** opens G3. The new group comes back ticked.
- **Save** applies both ticks and unticks.
- **Toasts:**
  - One group added: "Added to {Group}."
  - One group removed: "Removed from {Group}."
  - Several changes: "Groups updated."
  - A full group can't be ticked: "{Group} is full (100 creators). Remove someone or use another group."

**Menus and delete (G7)**

- **Group ⋯:** **Rename group**, **Delete group** (red).
- **Member ⋯:** **View profile**, **Remove from this group** (red). Removal is immediate, with toast "{Name} removed from {Group}."
- **Delete confirm:**
  - Title: 'Delete "{Group}"?'
  - Body: "The {N} creators stay on INFLX and in your other groups. Invitations you already sent aren't affected."
  - Buttons: **Keep** / **Delete** (red).
  - After: toast "Group deleted." and return to G1.

**Always true**

- Groups never change anything else: no invitations, no set membership, no notifications to creators.
- A member's status is **live**. It is recalculated on every load, never stored.

### 6.6 Find brands (F1–F3)

**Collabs tab (F1)**

- Segments: **Invites · Active · Pitches · Done**.
- The **"Pitch a brand"** card sits on top: "Find brands that accept pitches and match you." / **Find brands**.
- **Empty states until items 5–8:**
  - Invites: "No invitations yet" / "When a brand invites you to a set, it shows up here."
  - Active: "No active collaborations yet".
  - Pitches: "No pitches yet".
  - Done: "Nothing finished yet".

**Who appears (F2)**

- Approved, active brands only.
- **"Brands I can pitch"** is on by default and shows only brands whose status is `OK`.

**Status**

- Evaluated with the creator's profile only, as in item 2's `pitchSummary`:
  - brand paused **or** brand has blocked the creator → `NOT_ACCEPTING` → chip "Not accepting" (grey);
  - fails the brand's private filters → `NOT_MATCHING` → chip "You don't match" (red);
  - otherwise chip "Accepting" (green) plus the brand's accepted Aim and mode tags.
- The past-creators override from item 2 applies.

**Search, filters and sort**

- **Search:** brand name, case-insensitive.
- **Filters (F3):**
  - "Brands I can pitch" switch.
  - Category: any of the 8, matching any of the brand's sub-categories.
  - City: the brand has a branch in any selected city.
  - Accepts pitches for: the brand accepts at least one selected Aim.
  - Mode of work: at least one selected mode.
  - **Clear all** resets. The button shows "Show {N} brands".
- **Sort:** **Newest** (default, newest approval), **A–Z**, **Most products** (published count).

**Card:** logo, name, "{Sub-categories} · {Main city}", status chip and tags, chevron. Tap opens the overview.

### 6.7 Brand overview and product detail (O1–O4)

**Top of the overview (O1)**

- **Bar:** brand name and ⋯. The ⋯ menu holds item 2's **Block {Brand}**.
- **Header:** logo, name, "Fashion · {Main city} · {N} branches", sub-category tags, About.
- **"Accepts pitches for" card:** item 2, including its paused and not-matching banners.
- **Pitch this brand** (primary): placeholder until item 8, toast "Pitching brands is coming soon."
- **"Products {N} · See all":**
  - A 2-column grid of products: image, name, list price (₹ with Indian digit grouping).
  - An "Out of stock" chip on unavailable items; they stay visible.
  - **See all** opens the same grid, paginated.
  - **No offers or discounted prices, ever.**

**Scrolled (O2)**

- **"Posts by creators · Brand Store":** empty state "No posts yet" / "Shoppable posts creators make for {Brand} will show here." (until item 13).
- **"Branches {N}":** unique city tags with a pin. Hint: "Store Visit shoots happen at one of these branches. The exact address comes with the shoot plan."
- **Links:** website and Instagram tags that open outside the app.

**Product detail (O3)**

- Image carousel with dots, name, "{Brand} · {Category path}", price.
- **Sizes:** unavailable sizes shown struck through.
- Description.
- Info box: "You can add products to your posts once you have a Pay for Sale or Hybrid collaboration with this brand."
- **No buy button.**

**The brand's own view (O4)**, from Profile → Brand overview

- The same page, with bar "Brand overview" and info "This is what creators see."
- **Edit details** (→ A2) and **Pitch settings** (→ item 2 B2) replace Pitch and ⋯.
- Hint under products: "Products are added and edited on the brand website."

### 6.8 Profile tabs (A1–A5, A7–A9)

**Brand Profile list (A1)**

- **Header:** logo, name, "Fashion · {Sub-categories}", "{Main city} · {N} branches".
- **Rows:**

  | Row | Subtitle |
  |---|---|
  | Business details | "Name, logo, about, contact, GSTIN" |
  | Sub-categories | the list, or a warning when none |
  | Branches | "{N} locations · {cities}" |
  | Pitch settings | item 2 row |
  | Brand overview | "See what creators see" |
  | Links | "Website, Instagram" |
  | Legal & policies | — |

- Then **Log out**.

**Business details (A2)**

- **Logo upload:** "Brand logo" / "JPG or PNG, square, up to 5 MB" / **Change** / **Remove**.
- **Fields:** Brand name *, About (counter "{n} / 200", hint "Shown on your brand overview."), Contact person *, GSTIN.
- **Locked:** Phone and Major category, with a lock icon. Hint: "Phone and major category can't be changed here. Contact INFLX support to change them."
- **Button:** sticky **Save changes**.

**Sub-categories (A3)**

- Intro: "Pick everything you sell. Creators who choose categories in their invitation settings are matched against these."
- A locked "Major category · Fashion" card.
- 8 chips, required.
- **Brand with none set:** warning "Choose your sub-categories so creators who filter by category can find you." here **and** on the A1 row.

**Branches (A4)**

- **Cards:** name (plus a "Main" chip), full address, **Edit**, **Open in Maps** (on the main branch), **Remove** (on others).
- **Button:** "+ Add a branch".
- **Hint:** "Store Visit shoots happen at one of these branches. Creators see only the city names."
- **Remove confirm:**
  - Title: "Remove {Branch}?"
  - Body: "It won't be used for new Store Visit shoots. Shoots already planned there don't change."
  - Buttons: **Remove** (red) / **Keep**.

**Add or edit a branch (A5)**

- **Fields:** Branch name *, Address * (search field with Google results listed as name plus formatted address).
- **After picking a result:** a card with the full address and City and State tags, plus the city-added toast when it applies.
- **Switch:** "Make this the main branch".
- **Button:** **Save branch**.

**Creator My Profile (A7)**

- **Header:** photo, name, "{Niche} · {City}", "{Instagram} Instagram · {YouTube} YouTube".
- **Rows:**

  | Row | Subtitle |
  |---|---|
  | Profile info | "Photo, name, bio, city, social accounts" |
  | Niche & languages | "{Niche} · {Languages}" |
  | Invitation settings | item 2 row |
  | Payment & tax | existing summary, e.g. "UPI · PAN added" |
  | Legal & policies | — |

- Then **Log out**. The old notifications switch is removed.

**Profile info (A8)**

- **Photo upload:** "Profile photo" / "JPG or PNG, up to 5 MB" / **Change**.
- **Fields:** Full name *, Bio (counter "{n} / 150"), City * (Google search, hint "Search with Google. New cities are added to INFLX automatically."), Instagram, YouTube.
- **"Your numbers" card:** "Measured by INFLX", three stats. Hint: "Updated {d Mon}. These come from your connected accounts and can't be typed in."

**Niche & languages (A9)**

- "Your niche *" / "Pick the one that describes most of your content." / 20 chips, single select.
- "Languages you create in": 10 chips, multi-select.
- **Creator with no niche set:** warning "Pick your niche. Brands use it to find creators like you."

### 6.9 States on every list and profile screen (D4)

| State | What shows |
|---|---|
| Loading | Skeleton cards. |
| No results | "No creators match these filters" / "Try fewer filters or a wider follower range." / **Clear filters**. For brands: "No brands match these filters" / "Try fewer filters." |
| Couldn't load | "Couldn't load {creators \| brands \| groups \| this profile}" / "Check your connection and try again." / **Try again** |
| Saving | Spinner in the button, "Saving". |
| Save failed | Toast "Couldn't save. Your changes are still here, so try again." Edits are kept. |
| Leaving with unsaved changes | "Discard changes?" with **Discard** and **Keep editing** (item 2 hook). |

---

## 7. Validation and messages (server and app, same rules and same text)

| Field | Rule | Message |
|---|---|---|
| Brand name | Required | Enter your brand name. |
| Contact person | Required | Enter a contact person. |
| About | ≤ 200 characters | Keep it under 200 characters. |
| Logo / photo | JPG or PNG, ≤ 5 MB | Upload a JPG or PNG under 5 MB. |
| Sub-categories | At least 1 | Pick at least one sub-category. |
| Branch name | Required | Enter a branch name. |
| Branch address | Picked from Google results | Search and pick your branch address. |
| Main branch | Can't remove | The main branch can't be removed. Make another branch the main one first. |
| Full name | Required | Enter your full name. |
| Bio | ≤ 150 characters | Keep it under 150 characters. |
| Creator city | Picked from Google results | Search and pick your city. |
| Niche | Exactly one | Pick your niche to save. |
| Group name | Required after trimming | Enter a group name. |
| Group name | ≤ 40 characters | Keep it under 40 characters. |
| Group name | Unique per brand, case-insensitive | You already have a group with this name. |
| Group size | ≤ 100 | {Group} is full (100 creators). Remove someone or use another group. |

**Where errors show:**

- Errors appear **under the field**.
- Save is disabled while there are errors or while nothing has changed.
- Server errors return field codes that the app maps to these messages.

---

## 8. Look and feel (for the frontend check)

Item 2 added the theme. Confirm it matches:

- **Colours:**
  - bg `#FFFFFF`, surface `#F6F6F3`, border `#E5E4DE`.
  - ink `#1A1A17` / `#5B5A53` / `#77766E`.
  - primary `#FFC700`, pressed `#F0B400`, soft `#FFF3C4`.
  - State families: yourMove, waiting, active, completed, declined, disputed, ended.
- **Font:** Plus Jakarta Sans.
- **Yellow:** only for the single main button on a screen.
- **Selected chips:** ink background with white text. **Aim and mode tags:** neutral outline.
- **Segmented controls:** a surface background, with the selected segment white.
- **Four-segment controls** (Creators tab) must fit a 360 px-wide phone without wrapping.

---

## 9. Phase 1 checklist: what to read and report

### 9.1 Database

- Every table and column in §4 (D1–D12): exists, partial or missing.
- Branch JSONB shape, and a match count of existing branch cities and creator cities against `ref_cities`.
- Approval flags; account deletion behaviour; whether a brand has one user login or several.
- Any existing shortlist, saved or list table.
- The collaboration state source for P2, and a "completed" definition for P1.
- Product publication, variant model and stock data.
- Measured-at data for social numbers.
- Indexes needed for Discover and Find brands filters and sorts.

### 9.2 Backend

- Every endpoint in §5 (A1–A13): exists, partial or missing, with current response shapes and **every caller** (apps, brand website, admin).
- The item 2 eligibility service: can it compute brand-level status for a page of 20, and for up to 100 group members, in SQL?
- Places proxy, upload flow, and city resolution.
- **Privacy leaks today**, checked against §5 privacy rules. At minimum:
  - does the creator profile endpoint return email or phone;
  - does the brand public endpoint return addresses or GSTIN;
  - do discover endpoints return private settings.

### 9.3 Phone apps (`Packages/Mobile`)

- **Navigation:** the current single stacks (`BrandNavigator.js`, `InfluencerNavigator.js`) and what's needed for tab navigators. Is `@react-navigation/bottom-tabs` (or equivalent) installed, and is it OTA-safe?
- **Screens:** each screen in §2. For each one, give its file, what exists and what's missing, including the item 2 minimal profile and overview screens and the current long-form `BrandProfileScreen.js` and `ProfileScreen.js`.
- **Reusable components:** from item 2 (PickerSheet, StateCityPicker, Toast, useUnsavedGuard) and ones to add (segmented control, filter sheet, creator card, brand card, avatar stack, member row, checkbox row, product grid, carousel, empty/error/skeleton states).
- **Native modules:** image picker, and maps or places (if client-side). Report what's in the current binary.

### 9.4 Brand website (`Packages/brand-web`)

- Pages that call endpoints you'd change (creator search, creator detail, brand profile, branches, products).
- Confirm nothing in item 3 needs a website screen change, or list what does.

### 9.5 Admin

Where creators and brands are approved, and anything that reads branches or cities.

### 9.6 Tests

- The current backend test failure count (baseline).
- Existing tests that touch the endpoints you'd change.

---

## 10. Phase 1 output

Write **`Docs/ITEM3_DISCOVERY_GAP_REPORT.md`** with these sections:

1. **Summary.** A short, plain-language table: area · status · the one-line gap.
2. **Requirement table.** ID (D1–D12, A1–A13, each screen in §2, each rule group in §6) · requirement · status (E/P/M/C) · evidence (`file:line`) · proposed change · risk.
3. **Link readiness (§3).** One row per link: ready / not ready · what's missing · what item 3 must expose for the next item.
4. **Privacy check.** Every current leak found, with a fix.
5. **Proposed migrations** (additive), including backfill or mapping plans for branch cities, creator cities and approval-based visibility. Include dry-run checks.
6. **Proposed endpoints,** with request and response shapes, error codes, and the list of callers affected.
7. **Performance plan** for Discover, Find brands and group counts (queries, indexes, page size).
8. **Frontend plan per app:** navigation changes, files to add or change, components to reuse or add, and native-module needs.
9. **Test baseline:** current failure count, and a list of the tests you'll add in Phase 4.
10. **Questions for the founder.** Plain language, each with a recommendation so a "yes" is enough. Include every assumption in §11 plus anything new you find.

Then **stop and wait for approval.**

---

## 11. Assumptions to confirm in your questions

1. **"Most followers" sort:** uses the higher of Instagram followers and YouTube subscribers.
2. **Aims and Mode filters in Discover:** the creator accepts **at least one** of the selected values.
3. **Discover and group statuses are brand-level only:** open or blocked, then category match. Set-level checks come in item 5.
4. **Creators this brand has blocked:** a brand's block only stops that creator pitching the brand (§8A). Should they still appear in Discover and groups normally, or with a "Blocked by you" label?
5. **"Completed collaborations on INFLX":** the definition you propose from §19 and the existing data.
6. **"Out of stock" label:** the rule you propose, given that stock isn't tracked today.
7. **Variant model:** which one is read for product sizes.
8. **Existing free-text branch and creator cities:** matched to `ref_cities` by name within the state. Unmatched rows are **listed for review**, not auto-added. Or do you propose otherwise?
9. **A Google state not in `ref_states`:** your proposed handling.
10. **Removing a branch that has planned shoots:** allowed, since planned shoots keep their address? Confirm how shoot addresses are stored.
11. **Accounts removed from INFLX** leave every group: the approach you propose.
12. **Brand users:** groups are shared by all users of one brand, if brands have several logins.

---

## 12. After approval (not in this session)

A separate approval message will start these phases:

- **Phase 2, backend and database:** migrations, services, endpoints A1–A13, city auto-add, privacy fixes.
- **Phase 3, both phone apps:** tabs, every screen in §2, the reusable components, and every state and message in §6–§7.
- **Phase 4, tests and final functionality.** These are the checks the finished item must pass on a real phone:

1. **Tabs and placeholders.** Both apps open on their five tabs. Every placeholder tab shows its "coming soon" screen and its button works.
2. **Business details.** A brand saves them with a 4 MB JPG logo. A 6 MB PNG shows "Upload a JPG or PNG under 5 MB." A 201-character About can't be saved.
3. **Sub-categories reminder.** An existing brand with no sub-categories sees the reminder on A1 and A3, and can't save with none selected.
4. **City auto-add.**
   - A brand adds a Warangal branch when Warangal isn't in the list: the city is added with `source = 'google'` and the toast shows.
   - A second brand adding Warangal gets no toast and no duplicate row.
5. **Main branch.** It can't be removed. Making another branch the main one moves the Main chip.
6. **Creator profile.** A creator sets their city through Google search. Numbers are read-only with an updated date. The profile can't be saved without a niche.
7. **Discover statuses.**
   - Discover shows only approved creators that are `OK` by default, and the count matches the list.
   - With the toggle off, a paused creator shows "Not taking invitations".
   - A creator who blocked the brand looks **identical** to a paused one.
   - A creator who picked only Women, viewed by a Watches brand, shows "Not open to your brand".
8. **Filters.** Instagram 10K+, engagement 2%+ and city Hyderabad return only matching creators. "Show N creators" equals the list size. Clear all resets.
9. **Search.** "@priya" finds the handle; "Sharma" finds the name.
10. **Privacy in API responses.** Discover and creator profile responses contain no email, phone, visit cities, categories, minimums or block information. Brand overview responses contain no addresses, GSTIN, phone, contact person or offers.
11. **Worked with.** It lists only creators with both signatures. An agreed but unsigned handshake is not listed. Counts and dates are correct.
12. **Collaborations with you.** P2 shows only the viewing brand's collaborations with that creator.
13. **Group names.** Create "Diwali shortlist". "diwali shortlist" is rejected as a duplicate. A 41-character name is rejected.
14. **Adding creators in bulk.**
    - Add 3 creators through G5; creators already in the group are ticked and greyed.
    - Fill a group to 100: the 101st can't be added, with the right message.
15. **Adding from a card or profile.**
    - Add a creator from a Discover card and from the creator profile.
    - The profile then shows "In your groups: …".
    - Unticking in G6 removes them.
16. **Remove, rename, delete.** Remove a member, rename a group, delete a group. `campaign_influencers`, `contracts` and `influencer_proposals` rows are unchanged.
17. **Group privacy.** Another brand gets 404 for the group. No creator-facing response or notification mentions groups.
18. **Live counts.** When a member pauses invitations, "open to invitations" on G1 and G4 drops by one on the next load.
19. **Group placeholders.** "Invite to a set" and "New campaign" on a group show their coming-soon toasts and create nothing.
20. **Find brands.**
    - It defaults to brands the creator can pitch.
    - A paused brand shows "Not accepting"; a mismatched brand shows "You don't match".
    - Category, city, Aim and mode filters work, and so do the A–Z and Most products sorts.
21. **Brand overview and product detail.**
    - The overview shows only published products at list price, with the agreed out-of-stock rule and no offers.
    - Product detail is read-only, with unavailable sizes struck through and no buy button.
22. **Brand's own overview.** It shows "This is what creators see.", Edit details and Pitch settings, and no Pitch or ⋯.
23. **States and retry.** Loading, empty and couldn't-load states show on Discover, Worked with, Groups, group detail, Find brands and both profiles, and **Try again** works.
24. **Removed accounts.** A creator account removed from INFLX disappears from every group.
25. **Tests.** Backend tests show **no new failures** compared with the Phase 1 baseline.
