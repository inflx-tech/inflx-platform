# Workflow — Creator Experience Studio (Phase 6)

## 6a — data + creator API + engine fill (web/API-verifiable)

### Happy path (end state to prove)
1. Creator calls `GET /influencers/me/experience-templates?world_key=fashion` → published templates (Street Style Hero…).
2. Creator calls `GET /influencers/me/experience-stockable?template_id=…` → products from contracted brands.
3. Creator `POST /influencers/me/experiences` `{ template_id, product_ids:[…], featured_image_url }` → a draft `creator_experiences` row + `experience_products`.
4. Creator `POST /influencers/me/experiences/:id/publish` → validates the Theme's rules (min/max products, featured required) → `published`.
5. The `experience_template` rule, for a placed template's section, now resolves this published experience → builds a render spec (theme tokens + layout contract + the experience's pack).
6. **End state (6a):** a follower feed request for the Fashion home returns the Street Style section **with one item** ("Rahul's Street Style") — proven by unit + API + local DB, no emulator.

## 6b — Creator Studio mobile + follower render (mobile-governed)

### Creator (influencer app)
1. Studio → **Create Experience** → **Available Templates** (from 6a API).
2. Pick **Street Style** → title/subtitle/CTA + look are already known (theme+design).
3. **Select products** (stockable) → **Choose featured image** → **Publish**.

### Follower (follower app)
1. Home → the placed Street Style section now renders each published experience via `AdaptiveRenderer` (P4b).
2. Tap → the creator's experience (products, buy).

### End state (6b)
On device: a creator publishes → the follower home shows the experience, drawn adaptively. Verified off-device by jest; on-device by a Maestro flow (batched to a later real-device session).

## Failure / edge states
- Publish with fewer than the Theme's min products, or no featured image → 422 with the reason (Theme rule enforcement).
- A product from a non-contracted brand → rejected (403) at add time.
- A placed template with no published experiences → section stays empty (hidden) — unchanged from Phase 5.

## Proof of success
- 6a: unit (spec-builder) + API/DB (create→publish→rule resolves→feed includes it); `pnpm qa` green; zero regression; live home unchanged until first publish.
- 6b: jest for the Studio + follower render; Maestro flow authored (on-device batched).
