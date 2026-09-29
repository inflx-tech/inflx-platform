'use strict';

/**
 * shopperCopy.js — every sentence the shopper app gets from the server (follower-app-v2).
 * Contract: features/follower-app-v2 · boards F1–F13 · rules v1.7 §5
 */

const SHOP_FOR = [
  { key: 'women', label: 'Women' },
  { key: 'men', label: 'Men' },
  { key: 'kids', label: 'Kids' },
];

// F1 — the styles on the Welcome screen, drawn from the theme tags (occasion and style groups).
const WELCOME_STYLES = ['Festive', 'Casual', 'Korean Style', 'Office', 'Street Style', 'Elegant', 'Minimal', 'Boho'];

const MSG = {
  NOT_FOUND: "We couldn't find this post",
  GONE: 'This post is no longer available',
  UPCOMING: (day) => `This post goes live on ${day}`,
  COMMENT_EMPTY: 'Write something first.',
  COMMENT_LONG: 'Keep a comment under 300 characters.',
  REPORTED: 'Thanks. INFLX will look at this comment.',
  SIGN_IN: 'Sign in to like and comment',
  SIGN_IN_WHY: 'Your likes and comments are public. Saving and following work without signing in.',
  NO_FOLLOWER: 'Sign in with your number first.',
  CITY_UNKNOWN: 'Pick a city from the list.',
  SHOP_FOR_UNKNOWN: 'Choose Women, Men or Kids.',
  STYLE_UNKNOWN: 'Pick styles from the list.',
  CAUGHT_UP: "You're all caught up",
  NO_CODE: "No post has this code. Check the letters and numbers.",
  SAVED_GONE: (name, day) => `No longer available with this offer. ${name}'s post ${day ? `ended on ${day}` : 'has ended'}.`,
  SAVED_GONE_COLLECTION: 'No longer in the shop.',
  NO_WHERE: 'Tell us your city, or turn on location.',
};

module.exports = { SHOP_FOR, WELCOME_STYLES, MSG };
