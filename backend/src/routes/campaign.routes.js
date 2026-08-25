'use strict';

const { Router } = require('express');
const { authenticate, requireRole, requireApproved } = require('../middleware/auth');
const { checkQuota } = require('../middleware/quotaCheck');
const ctrl = require('../controllers/campaign.controller');

const router = Router();
const brandAuth = [authenticate, requireRole('brand')];
const brandApproved = [authenticate, requireRole('brand'), requireApproved];

// ── Campaign CRUD ────────────────────────────────────────────────────────────
router.post('/',       ...brandApproved, checkQuota('createCampaign'), ctrl.create);
router.get('/',        ...brandAuth, ctrl.list);
router.get('/:id',     ...brandAuth, ctrl.getById);
router.patch('/:id',   ...brandApproved, ctrl.update);
router.delete('/:id',  ...brandApproved, ctrl.remove);

// ── Campaign Publish / Cancel ─────────────────────────────────────────────────
// stage-2 ledger #96 — brand-side basket preview. Static path, so it is declared BEFORE
// the /:id routes that would otherwise swallow it.
router.post('/preview-basket', ...brandAuth, ctrl.previewBasket);

router.get('/:id/publish-check', ...brandAuth, ctrl.publishCheck);
router.post('/:id/publish', ...brandAuth, ctrl.publish);
router.post('/:id/cancel',  ...brandAuth, ctrl.cancel);
// collab-part5 — the deliberate finish. Distinct from cancel: completes rather than
// aborts, refunds nothing, and is the only way to close an open-ended sales campaign.
router.post('/:id/end',     ...brandAuth, ctrl.endCampaign);

// ── Cancel individual influencer assignment ──────────────────────────────────
router.post('/:id/influencers/:ciid/cancel', ...brandAuth, ctrl.cancelInfluencer);

// ── Open-group application review (status='applied' → accepted | rejected) ───
router.post('/:id/influencers/:ciid/approve-application', ...brandAuth, ctrl.approveApplication);
router.post('/:id/influencers/:ciid/reject-application',  ...brandAuth, ctrl.rejectApplication);

// ── Campaign Sets CRUD ───────────────────────────────────────────────────────
router.get('/:id/sets',                     ...brandAuth, ctrl.getSets);
router.post('/:id/sets',                    ...brandAuth, checkQuota('createSet'), ctrl.createSet);
router.patch('/:id/sets/:sid',              ...brandAuth, ctrl.updateSet);
router.delete('/:id/sets/:sid',             ...brandAuth, ctrl.deleteSet);
router.post('/:id/sets/:sid/duplicate',     ...brandAuth, ctrl.duplicateSet);

// ── Invite influencer to set (handpick) ─────────────────────────────────────
router.post('/:id/sets/:sid/invite', ...brandAuth, checkQuota('inviteInfluencer'), ctrl.invite);

// ── Update existing influencer assignment (draft editing) ───────────────────
router.patch('/:id/sets/:sid/influencers/:ciId', ...brandAuth, ctrl.updateInfluencer);

// ── Create offer for set (legacy) ───────────────────────────────────────────
router.post('/:id/sets/:sid/offers', ...brandAuth, ctrl.createOffer);

// ── Open-group set ───────────────────────────────────────────────────────────
const offerCtrl = require('../controllers/offer.controller');
router.post('/:id/sets/:sid/publish-open', ...brandAuth, offerCtrl.publishOpenGroup);

// ── Influencer search (for handpick modal) ───────────────────────────────────
router.get('/:id/influencer-search', ...brandAuth, ctrl.searchInfluencers);

// ── Open-group match count ───────────────────────────────────────────────────
router.get('/:id/sets/:sid/open-group-matches', ...brandAuth, ctrl.openGroupMatches);

// ── Live hierarchy ───────────────────────────────────────────────────────────
router.get('/:id/live', ...brandAuth, ctrl.getLiveHierarchy);

// ── Campaign products ─────────────────────────────────────────────────────────
router.get('/:id/products', ...brandAuth, ctrl.getCampaignProducts);

module.exports = router;
