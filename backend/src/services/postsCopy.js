'use strict';

/**
 * postsCopy.js — every word the shoppable-post screens and notices say (Level 3).
 * Contract: features/shoppable-posts-v2 · rules v1.4 §4 · boards P1–P20.
 * The phone keeps an identical copy (components/posts/copyPosts.js).
 */

const MSG = {
  NOT_POSTABLE: 'You can post for this collaboration after both signatures and the shoot.',
  NOT_FOUND: 'Not found',
  KIND_NEEDED: 'Choose an offer post or a price post.',
  NO_OFFERS: 'This collaboration has no offers running.',
  NO_FREE_PRODUCTS: 'Every product you have in this collaboration is in an offer.',
  OFFER_NOT_YOURS: 'Pick one of the offers in this collaboration.',
  OFFER_ENDED: 'That offer has ended. Pick another one.',
  OFFER_NEEDED: 'Pick an offer.',
  PRODUCT_NOT_IN_OFFER: "A product isn't in this offer any more. Pick again.",
  PRODUCT_NOT_YOURS: "A product isn't one of your products without offers any more. Pick again.",
  PICK_AT_LEAST_ONE: 'Pick at least 1 product.',
  PICK_AT_LEAST: (n) => `Pick at least ${n} so a shopper can complete the bundle from this post.`,
  TOO_MANY_PRODUCTS: 'Up to 30 products in a post.',
  TAGS_MIN: 'Pick at least 1 theme tag.',
  TAGS_ONE_PER_GROUP: 'Pick at most 1 tag from each group.',
  TAG_UNKNOWN: "A theme tag isn't one of INFLX's tags.",
  MEDIA_MIN: 'Add at least one photo or video.',
  MEDIA_MAX: 'Up to 10 in a carousel.',
  MEDIA_SINGLE: 'A single post has one photo or video. Choose Carousel for more.',
  MEDIA_KIND_MIX: 'A post is all photos or all videos.',
  MEDIA_NOT_YOURS: 'Upload the photos and videos from this post.',
  MEDIA_NOT_UPLOADED: "A file didn't finish uploading. Add it again.",
  FILE_TYPE: 'Photos must be JPEG, PNG or WebP. Videos must be MP4.',
  FILE_TOO_BIG: (mb) => `Keep each file under ${mb} MB.`,
  VIDEO_TOO_LONG: 'Each video can be up to 90 seconds.',
  PIN_BAD: 'Tap a product on a photo in this post.',
  CAPTION_LONG: 'Keep the caption under 2,000 characters.',
  CAPTION_NEEDED: 'Write a caption.',
  SENT: "This post is with INFLX now. It can't be changed.",
  APPROVED_LOCKED: "An approved post can't be changed. You can take it down.",
  SENT_BACK_ONLY: 'When a post is sent back you can change photos and videos, caption, products and theme tags. For anything else, start a new post.',
  REMOVED: 'This post has left the shop.',
  CANT_DELETE: 'Only drafts and sent-back posts can be deleted.',
  CANT_TAKE_DOWN: 'Only an approved post can be taken down.',
  CANT_SEND: "This post can't be sent now.",
  RETIRED: 'The old post composer is retired. Update the app to make shoppable posts.',
  // admin
  STALE: (why) => `This post can't be approved: ${why}`,
};

const REMOVED_WHY = {
  offer_ended: (offer) => `The offer ${offer ? `"${offer}" ` : ''}ended. Your post promised it, so it can't stay up at full price.`,
  products_removed: () => 'The brand removed all its products from the offer.',
  unavailable: () => "The brand's products in this post are no longer on sale.",
  sold_out: () => 'Every product sold out.',
  taken_down: () => 'You took this post down.',
};

const NOTIFY = {
  // `liveOn`: set only when its offer has not started yet (posting-date-last-day: an approved post is live at once).
  approved: (title, liveOn) => ({ type: 'post.approved', title: `"${title}" is approved`,
    body: liveOn ? `It goes live on ${liveOn}, when its offer starts.` : 'It is live in the shop now.' }),
  sentBack: (title, reason) => ({ type: 'post.rejected', title: `"${title}" was sent back`, body: `What INFLX said: "${reason}"` }),
  removed: (title, why) => ({ type: 'post.removed', title: `"${title}" left the shop`, body: why }),
  productsLeft: (title, n) => ({ type: 'post.products_removed', title: `${n} product${n > 1 ? 's' : ''} left "${title}"`, body: 'The brand took them out of the offer. The rest of the post stays in the shop.' }),
};

module.exports = { MSG, REMOVED_WHY, NOTIFY };
