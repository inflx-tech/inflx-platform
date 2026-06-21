# Workflow Definition — Food dish groups

## Actor
Admin (build tiles, capability master_data). Then a follower (discovery).

## Preconditions
Dictionary seeded (master_dishes). Restaurants with in-store dishes.

## Workflow steps (observable)
### Admin
1. Admin → /admin/dish-groups → "+ New group" → names it "Biryani".
2. The member editor opens with dishes auto-suggested by name (Chicken/Mutton/
   Veg Biryani… pre-ticked) → admin confirms / adjusts → Save.
3. Optional keyword "biryani" set as a custom-dish safety net.
4. Group appears as an active tile (reorder / hide / delete available).

### Follower
5. `GET /follower/dish-groups` lists active tiles.
6. Tap "Biryani" → `GET /follower/dish-groups/:id/restaurants?lat&lng` →
   nearby restaurants serving a member biryani OR a keyword-matched custom
   biryani, nearest first, each with varieties + "from ₹X" + rating.

## Success definition
- Admin can create a group, set members (auto-suggested), set keyword.
- Tap returns exactly the restaurants serving the group's dishes near the user,
  ordered by distance then popularity; non-serving restaurants excluded.

## Failure / edge workflows
- Group with no members and no keyword → empty restaurant list.
- No lat/lng → results unordered by distance (popularity only).
- Custom (non-dictionary) dish → caught only if the keyword matches its name.
