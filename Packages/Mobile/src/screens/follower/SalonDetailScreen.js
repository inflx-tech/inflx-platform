/**
 * SalonDetailScreen — named entry point. Implementation is SchemaDetailScreen,
 * schema-driven via salon.json's card_config.detail_sections (description +
 * spec_grid + feature_chips for inclusions + gallery for before_after_images).
 * The "View Salon" affordance is the Path B tracking propagator.
 *
 * "Book Slot" CTA navigates via the parent's action dispatcher to
 * SlotPickerScreen with the service + tracking context.
 */
export { default } from './SchemaDetailScreen';
