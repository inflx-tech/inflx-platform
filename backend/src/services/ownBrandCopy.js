'use strict';

/**
 * ownBrandCopy.js — every word item 20 says from the server: linking a creator to the brand he
 * runs, posting for it, and where he shared a post.
 * Contract: features/item20-own-brand · rules v1.33 §2D · board L1–L6, B1–B3, C1–C5, S1–S3.
 */

const MSG = {
  INVALID_PHONE: 'Enter a valid Indian mobile number.',
  NO_BRAND: 'No brand on INFLX uses this number.',
  ALREADY_LINKED: (brand) => `You are already linked to ${brand}. Remove that link first.`,
  NOT_LINKED: "You haven't linked a brand.",
  TOO_MANY_SENDS: 'Too many codes asked for today. Try again tomorrow.',
  TOO_MANY_TO_NUMBER: 'Too many codes were sent to this number. Try again in an hour.',
  EXPIRED: "Time's up. Start again — you have 15 minutes from the code being sent.",
  WRONG_CODE: "That code isn't right.",
  TOO_MANY_WRONG: 'Too many wrong codes. Start again.',
  CODE_NEEDED: 'Enter the 6-digit code.',
  NOT_YOUR_CREATOR: 'That creator is not linked to your brand.',
  // posting
  OWN_NOT_LINKED: 'Your link to this brand was removed, so you can no longer post for it.',
  OWN_BRAND_NOT_APPROVED: 'You can post for this brand once INFLX approves it.',
  OWN_BRAND_STOPPED: "You can't post for this brand right now.",
  OWN_NO_OFFERS: 'Your store has no offers running.',
  OWN_NO_FREE_PRODUCTS: 'Every product in your store is in an offer.',
  OWN_OFFER_NOT_YOURS: "Pick one of your store's offers.",
  OWN_TYPES_HIDDEN: (list, many) => `${list} ${many ? "aren't" : "isn't"} shown because your store has none.`,
  OWN_LINE: 'Anything your store sells. No collaboration needed.',
  OWN_LINE_PENDING: 'Opens when INFLX approves your brand',
  OWN_LINE_STOPPED: "Can't be posted for right now",
  YOUR_BRAND: 'your brand',
  // where he shared it
  PLACE_UNKNOWN: 'Choose where you shared it.',
  PLACE_LINK_NEEDED: 'Paste the link.',
  PLACE_LINK_BAD: (site) => `That isn't a ${site} link. Paste the link to your post there.`,
  PLACE_NOT_YET: 'You can add where you shared a post once INFLX has approved it.',
  PLACE_OWN_ONLY: 'This is for posts you make for your own brand.',
  PLACE_MAX: 'Up to 20 places for one post.',
};

/** Who a brand is waiting on, in the words My brand shows. */
const BRAND_STATE = {
  approved: { chip: 'Approved', note: null },
  pending: { chip: 'Under review', note: (name) => `${name} is under review. You can post for it once INFLX approves it.` },
  rejected: { chip: 'Not approved', note: () => "You can't post for this brand right now." },
  suspended: { chip: 'Suspended', note: () => "You can't post for this brand right now." },
};

const NOTIFY = {
  linked: (creator, brand) => ({ type: 'own_brand.linked', title: `${creator} linked a creator account`,
    body: `${creator} can now post for ${brand} without a campaign. Not someone you know? Remove the link.` }),
  removedByCreator: (creator, brand) => ({ type: 'own_brand.unlinked', title: `${creator} removed the link`,
    body: `${creator} can no longer make new posts for ${brand}. Posts already live stay live.` }),
  removedByBrand: (brand) => ({ type: 'own_brand.removed', title: `${brand} removed your link`,
    body: 'Your live posts for it stay live. You can no longer make new ones.' }),
};

module.exports = { MSG, BRAND_STATE, NOTIFY };
