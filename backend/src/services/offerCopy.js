'use strict';

/**
 * offerCopy — every sentence the offer builder sends to a person. Contract: features/offer-builder-v2
 * Notices to creators follow rules 1.10 and 1.11 (and 2.11: she's told when an offer she has ends,
 * loses products, or a product's price changes). Kept in one place so the words can be read together.
 */

const { inr } = require('./offerRules');

const names = (list, max = 3) => {
  const shown = list.slice(0, max).join(', ');
  return list.length > max ? `${shown} and ${list.length - max} more` : shown;
};

const NOTIFY = {
  ended: (offerName, brandName) => ({
    type: 'offer_ended',
    title: `"${offerName}" has ended`.slice(0, 100),
    body: `${brandName} ended this offer today. Posts using it leave the shop.`,
  }),
  productsRemoved: (offerName, brandName, productNames) => ({
    type: 'offer_products_removed',
    title: `${productNames.length} product${productNames.length > 1 ? 's' : ''} removed from "${offerName}"`.slice(0, 100),
    body: `${brandName} took ${names(productNames)} out of this offer. They leave your posts using it.`,
  }),
  priceChanged: (productName, oldPrice, newPrice, offerName) => ({
    type: 'offer_price_changed',
    title: `Price changed: ${productName}`.slice(0, 100),
    body: `${inr(oldPrice)} → ${inr(newPrice)} · in "${offerName}".`,
  }),
};

module.exports = { NOTIFY, names };
