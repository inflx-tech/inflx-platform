'use strict';

/**
 * shopper.controller.js — the shopper app's server (follower-app-v2).
 * Contract: features/follower-app-v2 · boards F1–F13 · rules v1.7 §5
 *
 * Most reads work for guests (authenticateOptional): a guest is known by the phone's anonymous
 * id (x-device-id) and sends her follows, Welcome choices and location with each request. Nothing
 * about where she is gets stored (5.3).
 */

const appConfig = require('../services/followerAppConfig.service');
const sp = require('../services/shopperPosts.service');
const feed = require('../services/shopperFeed.service');
const stores = require('../services/shopperStores.service');
const eng = require('../services/shopperEngagement.service');
const { success } = require('../utils/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const who = (req) => sp.resolveWho(sp.whoOf(req));
const visitor = (req) => ({ ua: String(req.headers['user-agent'] || '').slice(0, 400) });
const h = (fn) => asyncHandler(async (req, res) => success(res, await fn(req, await who(req))));

// PATCH /v1/admin/app-config — shallow-merges keys into the one config row.
const updateAppConfig = asyncHandler(async (req, res) => {
  let config;
  try { config = await appConfig.update(req.body && req.body.config); }
  catch (e) { throw new AppError('VALIDATION_ERROR', e.message, 422); }
  return success(res, { config });
});

module.exports = {
  appConfig: asyncHandler(async (req, res) => success(res, { config: await appConfig.get() })),
  updateAppConfig,

  // F1 · F13
  welcome: asyncHandler(async (req, res) => success(res, await eng.welcome())),
  profile: h((req, w) => eng.profile(w)),
  preferences: h((req, w) => eng.setPreferences(w, req.body || {})),
  merge: h((req, w) => eng.merge(w, req.body || {})),

  // F2 · F5 · F4
  feed: h((req, w) => feed.feed(w, { mode: req.body && req.body.mode === 'play' ? 'play' : 'home', served: (req.body || {}).served, start: (req.body || {}).start })),
  circles: h((req, w) => feed.circles(w, { since: req.query.since || null })),
  post: h((req, w) => sp.one(req.params.id, w)),
  more: h((req, w) => sp.more(req.params.id, w, { served: String(req.query.served || '').split(',') })),

  // F12
  search: h((req, w) => sp.search(req.query.q, w, visitor(req))),
  // ?ch= when a post link (inflx.in/p/<code>/<ch>) opens in the app; none = a code typed in search.
  code: h((req, w) => sp.byCode(req.params.code, w, visitor(req), req.query.ch ? require('../services/postLinks.service').channelOf(req.query.ch) : 'code')),

  // F3 · F6 · F11
  like: h((req, w) => eng.setLike(w, req.params.id, true)),
  unlike: h((req, w) => eng.setLike(w, req.params.id, false)),
  save: h((req, w) => eng.setSave(w, req.params.id, true)),
  unsave: h((req, w) => eng.setSave(w, req.params.id, false)),
  saved: h((req, w) => eng.saved(w)),
  resolveSaved: h((req, w) => eng.resolveSaved(w, req.body || {})),
  saveProduct: h((req, w) => eng.saveProduct(w, req.body || {})),
  unsaveProduct: h((req, w) => eng.unsaveProduct(w, req.params.productId)),
  comments: h((req, w) => eng.comments(req.params.id, w, { before: req.query.before })),
  addComment: h((req, w) => eng.addComment(w, req.params.id, (req.body || {}).body)),
  report: h((req, w) => eng.reportComment(w, req.params.id)),
  follow: h((req, w) => eng.setFollow(w, (req.body || {}).influencer_id, true)),
  unfollow: h((req, w) => eng.setFollow(w, req.params.influencer_id, false)),
  following: h((req, w) => eng.following(w)),

  // F7 – F10
  creatorStore: h((req, w) => stores.creatorStore(req.params.id, w)),
  creatorPosts: h((req, w) => stores.creatorPosts(req.params.id, w, { tab: req.query.tab, category: req.query.category, offset: req.query.offset })),
  creatorCollections: h((req) => stores.creatorCollections(req.params.id)),
  collection: h((req, w) => stores.openCollection(req.params.id, w)),
  brandStore: h((req, w) => stores.brandStore(req.params.id, w)),
  brandPosts: h((req, w) => stores.brandPosts(req.params.id, w, { category: req.query.category, creator: req.query.creator, offer: req.query.offer, offset: req.query.offset })),
  brandOffers: h((req, w) => stores.brandOffers(req.params.id, w, { type: req.query.type, band: req.query.band, category: req.query.category, theme: req.query.theme })),
  filters: asyncHandler(async (req, res) => success(res, await stores.filterWords())),

  // admin
  reportedComments: asyncHandler(async (req, res) => success(res, await eng.reportedComments())),
  decideComment: asyncHandler(async (req, res) => success(res, await eng.decideComment(req.user.sub, req.params.id, (req.body || {}).decision))),
  feedReadiness: asyncHandler(async (req, res) => success(res, await feed.readiness())),
  feedPreview: asyncHandler(async (req, res) => success(res, await feed.preview({ followerId: req.query.follower_id || null, phone: req.query.phone || null }))),
};
