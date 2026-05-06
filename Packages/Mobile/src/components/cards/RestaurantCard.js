/**
 * RestaurantCard — named entry point. Implementation is SchemaCard, driven
 * entirely by template.card_config from restaurant.json. The diff between
 * RestaurantCard and SalonCard is the schema; the JS file is the same.
 *
 * Per spec section 1: "If RestaurantCard ends up with any subtitle/tag/CTA
 * logic in JS, the refactor wasn't deep enough." This re-export keeps
 * search-by-name working without forking the implementation.
 */
export { default } from './SchemaCard';
