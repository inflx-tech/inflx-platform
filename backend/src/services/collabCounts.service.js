'use strict';

/**
 * collabCounts.service.js — "how much needs you", counted once, on the server.
 * Contract: features/collab-phase0-foundations  (Phase 0)
 *
 * THE RULE, AND THE ONLY RULE
 * A node's count is **everything beneath it plus anything owed at that node itself**.
 * If a campaign shows 4 and its two sets show 3 and 0, the missing 1 is the campaign's
 * own and must be listed at that level, not buried. Numbers that don't reconcile are
 * how people stop believing badges.
 *
 * WHY IT IS HERE AND NOT IN THE APPS
 * The same collaboration is counted on two phones. Derive it twice and the two will
 * eventually disagree — which is the failure the whole spine exists to prevent.
 *
 * WHAT THIS DOES NOT DO YET
 * Nothing renders these numbers. Phase 2 puts them on the creator's Collabs tab and
 * Phase 4 on the brand's campaign drill-down. Shipping the calculation first means
 * both apps read the same answer from day one rather than racing to invent it.
 */

const db = require('../config/db');
const step = require('./collabStep.service');
// Stage 3 — what is owed at a level that belongs to no creator, as a LIST.
const owedItems = require('./collabOwedItems.service');

/**
 * Everything owed to a BRAND, as a tree that reconciles at every level.
 *
 * Returns:
 *   {
 *     total,                       // the tab-bar badge
 *     creators_tab,                // conversations before any campaign exists
 *     campaigns: [                 // one per campaign, each already rolled up
 *       { campaign_id, name, own, total,
 *         sets: [ { set_id, name, own, total,
 *                   creators: [ { campaign_influencer_id, influencer_id, name, own } ] } ] }
 *     ]
 *   }
 */
async function forBrand(brandId) {
  // ── Creators tab: conversations that have not become a campaign yet ──────────
  // A brand owes an answer when the creator moved last, or when she pitched cold.
  const { rows: convo } = await db.query(
    `SELECT
       (SELECT count(*)::int FROM brand_collab_requests r
         WHERE r.brand_id = $1
           AND r.status = 'countered' AND r.counter_by = 'creator')                       AS her_counters,
       (SELECT count(*)::int FROM influencer_proposals p
         WHERE p.brand_id = $1
           AND (p.status IN ('sent','viewed')
                OR (p.status = 'countered' AND p.counter_by = 'creator')))                AS her_pitches,
       (SELECT count(*)::int FROM collab_agreements a
         WHERE a.brand_id = $1 AND a.status = 'ready'
           AND a.expires_at < now() + interval '14 days')                                 AS expiring_agreements,
       -- Item 7: both of the brand's agreement moves. "Send agreement" — she
       -- accepted and nothing has gone out — and "Sign" — she signed and the
       -- brand has not. Neither was counted anywhere before; a draft sitting
       -- unsent was invisible in every Needs You number.
       (SELECT count(*)::int FROM contracts con
          JOIN campaign_influencers ci ON ci.id = con.campaign_influencer_id
          JOIN campaign_sets cs ON cs.id = ci.set_id
          JOIN campaigns c ON c.id = cs.campaign_id
         WHERE c.brand_id = $1 AND con.status = 'draft'
           AND ci.status IN ('accepted', 'applied'))                                      AS agreements_to_send,
       (SELECT count(*)::int FROM contracts con
          JOIN campaign_influencers ci ON ci.id = con.campaign_influencer_id
          JOIN campaign_sets cs ON cs.id = ci.set_id
          JOIN campaigns c ON c.id = cs.campaign_id
         WHERE c.brand_id = $1 AND con.status = 'pending_brand'
           AND con.influencer_signed_at IS NOT NULL AND con.brand_signed_at IS NULL)      AS agreements_to_sign`,
    [brandId]
  );
  const c = convo[0] || {};
  const creatorsTab =
    Number(c.her_counters || 0) + Number(c.her_pitches || 0) + Number(c.expiring_agreements || 0)
    + Number(c.agreements_to_send || 0) + Number(c.agreements_to_sign || 0);

  // ── Per creator, inside a campaign ───────────────────────────────────────────
  // One row per assignment, carrying just enough for the step calculation to run.
  const { rows: assignments } = await db.query(
    `SELECT ci.id                       AS campaign_influencer_id,
            ci.influencer_id,
            ci.status                   AS ci_status,
            u.name                      AS influencer_name,
            cs.id                       AS set_id,
            cs.name                     AS set_name,
            cs.goal                     AS set_goal,
            cam.id                      AS campaign_id,
            cam.name                    AS campaign_name,
            cam.status                  AS campaign_status,
            con.status                  AS contract_status,
            (con.influencer_signed_at IS NOT NULL AND con.brand_signed_at IS NOT NULL) AS contract_signed_both,
            (pe.status = 'completed' OR pe.visit_completed_at IS NOT NULL) AS shoot_done,
            pe.status                   AS shoot_status,
            (SELECT count(*)::int FROM deliverables d
              WHERE d.campaign_influencer_id = ci.id
                AND d.status IN ('submitted','under_review'))            AS deliverables_awaiting_brand,
            (SELECT count(*)::int FROM deliverables d
              WHERE d.campaign_influencer_id = ci.id
                AND d.live_url IS NOT NULL AND d.live_confirmed_at IS NULL) AS deliverables_awaiting_confirm,
            (SELECT n.current_turn FROM negotiations n WHERE n.campaign_influencer_id = ci.id AND n.outcome IS NULL LIMIT 1) AS negotiation_turn
       FROM campaign_influencers ci
       JOIN campaign_sets cs   ON cs.id  = ci.set_id
       JOIN campaigns cam      ON cam.id = cs.campaign_id
       JOIN influencers inf    ON inf.id = ci.influencer_id
       JOIN users u            ON u.id   = inf.user_id
       LEFT JOIN contracts con ON con.campaign_influencer_id = ci.id
       LEFT JOIN production_events pe ON pe.contract_id = con.id
      WHERE cam.brand_id = $1
        AND cam.status NOT IN ('cancelled', 'completed')`,
    [brandId]
  );

  // ── Owed at set level and campaign level ─────────────────────────────────────
  // These belong to no single creator, which is exactly why they need their own line.
  //
  // Stage 3 moved them into collabOwedItems and turned them into a LIST. A bare integer
  // is a badge you cannot walk down, and FINAL 4 rule is that tapping a number gets you
  // to a button every time — which a screen cannot do if it was only told "2".
  //
  // `own` is now the length of that list, so the badge and the things it is made of are
  // the same fact and cannot disagree.
  //
  // The older note here said an expiring offer could not be computed because offers had
  // no expiry. That is stale: campaign_influencers.offer_valid_until (migration 148) and
  // brand_offers.store_ends_at both exist. It IS computed now, and returns nothing until
  // something writes a deadline — which no screen can do yet. See collabOwedItems.
  const [setItems, campaignItems] = await Promise.all([
    owedItems.forSets(brandId, db),
    owedItems.forCampaigns(brandId, db),
  ]);
  // ── Assemble, then roll up ───────────────────────────────────────────────────
  const campaigns = new Map();
  for (const a of assignments) {
    const derived = step.stepForCollaboration(
      { status: a.ci_status },
      {
        track: a.set_goal === 'engagement' ? 'content' : (a.set_goal === 'hybrid' ? 'both' : 'sales'),
        // Item 7 (approval Q11): the SIGNATURE TIMESTAMPS decide, not the status.
        // Four seeded production rows are 'active' with no signatures at all, and
        // two definitions of "signed by both" had been coexisting in the codebase.
        contractSignedByBoth: a.contract_signed_both === true,
        shootDone: !!a.shoot_done,
        shootTurn: a.shoot_status === 'proposed' ? step.TURN.YOU_BRAND : step.TURN.NOBODY,
        socialState: Number(a.deliverables_awaiting_confirm) > 0 ? 'posted'
                   : Number(a.deliverables_awaiting_brand) > 0 ? 'submitted' : 'none',
        negotiationTurn: a.negotiation_turn || null,
      }
    );
    const own = step.owes(derived, step.TURN.YOU_BRAND);

    if (!campaigns.has(a.campaign_id)) {
      campaigns.set(a.campaign_id, {
        campaign_id: a.campaign_id,
        name: a.campaign_name,
        items: campaignItems.get(a.campaign_id) || [],
        sets: new Map(),
      });
    }
    const camp = campaigns.get(a.campaign_id);
    if (!camp.sets.has(a.set_id)) {
      camp.sets.set(a.set_id, {
        set_id: a.set_id,
        name: a.set_name,
        items: setItems.get(a.set_id) || [],
        creators: [],
      });
    }
    camp.sets.get(a.set_id).creators.push({
      campaign_influencer_id: a.campaign_influencer_id,
      influencer_id: a.influencer_id,
      name: a.influencer_name,
      step: derived.step,
      turn: derived.turn,
      own,
    });
  }

  const out = [...campaigns.values()].map(camp => {
    const sets = [...camp.sets.values()].map(s => ({
      ...s,
      own: s.items.length,
      total: step.rollUp({ own: s.items.length, children: s.creators.map(cr => ({ own: cr.own })) }),
    }));
    return {
      campaign_id: camp.campaign_id,
      name: camp.name,
      own: camp.items.length,
      items: camp.items,
      sets,
      total: step.rollUp({ own: camp.items.length, children: sets.map(s => ({ own: s.total })) }),
    };
  });

  return {
    total: creatorsTab + out.reduce((n, c) => n + c.total, 0),
    creators_tab: creatorsTab,
    campaigns: out,
  };
}

/**
 * Everything owed to a CREATOR. Flat — she has no campaigns of her own to nest under,
 * and her question is "what do I have to do", not "where in a hierarchy is it".
 */
async function forCreator(influencerId) {
  const { rows } = await db.query(
    `SELECT
       (SELECT count(*)::int FROM brand_collab_requests r
         WHERE r.influencer_id = $1
           AND (r.status IN ('sent','viewed')
                OR (r.status = 'countered' AND r.counter_by = 'brand')))              AS invitations,
       (SELECT count(*)::int FROM influencer_proposals p
         WHERE p.influencer_id = $1
           AND p.status = 'countered' AND p.counter_by = 'brand')                     AS pitch_counters,
       (SELECT count(*)::int FROM campaign_influencers ci
         WHERE ci.influencer_id = $1 AND ci.status = 'invited')                       AS invites_to_answer,
       -- Item 6: a counter waiting for HER reply (negotiations.current_turn), never the brand's.
       (SELECT count(*)::int FROM negotiations n
         JOIN campaign_influencers cin ON cin.id = n.campaign_influencer_id
        WHERE cin.influencer_id = $1 AND n.outcome IS NULL AND n.current_turn = 'influencer'
          AND cin.status = 'negotiating')                                             AS counters_to_answer,
       (SELECT count(*)::int FROM contracts con
         JOIN campaign_influencers ci2 ON ci2.id = con.campaign_influencer_id
        WHERE ci2.influencer_id = $1 AND con.status = 'pending_influencer')           AS contracts_to_sign,
       (SELECT count(*)::int FROM creator_posts cp
         WHERE cp.influencer_id = $1 AND cp.status = 'rejected')                      AS posts_to_fix,
       (SELECT count(*)::int FROM deliverables d
         JOIN campaign_influencers ci3 ON ci3.id = d.campaign_influencer_id
        WHERE ci3.influencer_id = $1
          AND d.status IN ('pending','revision_requested'))                           AS deliverables_to_submit`,
    [influencerId]
  );
  const r = rows[0] || {};
  const items = {
    invitations:            Number(r.invitations || 0),
    pitch_counters:         Number(r.pitch_counters || 0),
    invites_to_answer:      Number(r.invites_to_answer || 0),
    counters_to_answer:     Number(r.counters_to_answer || 0),
    contracts_to_sign:      Number(r.contracts_to_sign || 0),
    posts_to_fix:           Number(r.posts_to_fix || 0),
    deliverables_to_submit: Number(r.deliverables_to_submit || 0),
  };
  return {
    total: Object.values(items).reduce((a, b) => a + b, 0),
    items,
  };
}

/**
 * Stage 0 — her collaborations, each carrying the step number the SERVER derived.
 *
 * `forBrand` already returns step and turn per creator inside a campaign. The creator
 * had no equivalent, so her app had nothing to read and would have had to work the
 * number out for itself — which is precisely the disagreement this module exists to
 * prevent. Same calculation, same inputs, her side of the table.
 *
 * Contract: features/stage-0-clear-the-decks.
 */
async function stepsForCreator(influencerId) {
  const { rows } = await db.query(
    `SELECT ci.id                       AS campaign_influencer_id,
            ci.status                   AS ci_status,
            cs.id                       AS set_id,
            cs.name                     AS set_name,
            cs.goal                     AS set_goal,
            cam.id                      AS campaign_id,
            cam.name                    AS campaign_name,
            b.id                        AS brand_id,
            b.business_name             AS brand_name,
            con.status                  AS contract_status,
            (con.influencer_signed_at IS NOT NULL AND con.brand_signed_at IS NOT NULL) AS contract_signed_both,
            (pe.status = 'completed' OR pe.visit_completed_at IS NOT NULL) AS shoot_done,
            pe.status                   AS shoot_status,
            (SELECT count(*)::int FROM deliverables d
              WHERE d.campaign_influencer_id = ci.id
                AND d.status IN ('submitted','under_review'))              AS deliverables_awaiting_brand,
            (SELECT count(*)::int FROM deliverables d
              WHERE d.campaign_influencer_id = ci.id
                AND d.live_url IS NOT NULL AND d.live_confirmed_at IS NULL) AS deliverables_awaiting_confirm,
            (SELECT n.current_turn FROM negotiations n WHERE n.campaign_influencer_id = ci.id AND n.outcome IS NULL LIMIT 1) AS negotiation_turn
       FROM campaign_influencers ci
       JOIN campaign_sets cs   ON cs.id  = ci.set_id
       JOIN campaigns cam      ON cam.id = cs.campaign_id
       JOIN brands b           ON b.id   = cam.brand_id
       LEFT JOIN contracts con ON con.campaign_influencer_id = ci.id
       LEFT JOIN production_events pe ON pe.contract_id = con.id
      WHERE ci.influencer_id = $1
        AND cam.status NOT IN ('cancelled')
      ORDER BY cam.created_at DESC`,
    [influencerId]
  );

  return rows.map((a) => {
    // Identical inputs to forBrand's call, so the same collaboration cannot report a
    // different step to the two sides. The only difference is whose turn "yours" is,
    // and that is read from `turn`, never recomputed.
    const derived = step.stepForCollaboration(
      { status: a.ci_status },
      {
        track: a.set_goal === 'engagement' ? 'content' : (a.set_goal === 'hybrid' ? 'both' : 'sales'),
        // Item 7 (approval Q11): the SIGNATURE TIMESTAMPS decide, not the status.
        // Four seeded production rows are 'active' with no signatures at all, and
        // two definitions of "signed by both" had been coexisting in the codebase.
        contractSignedByBoth: a.contract_signed_both === true,
        shootDone: !!a.shoot_done,
        shootTurn: a.shoot_status === 'proposed' ? step.TURN.YOU_BRAND : step.TURN.NOBODY,
        socialState: Number(a.deliverables_awaiting_confirm) > 0 ? 'posted'
                   : Number(a.deliverables_awaiting_brand) > 0 ? 'submitted' : 'none',
        negotiationTurn: a.negotiation_turn || null,
      }
    );
    return {
      campaign_influencer_id: a.campaign_influencer_id,
      campaign_id:   a.campaign_id,
      campaign_name: a.campaign_name,
      set_id:        a.set_id,
      set_name:      a.set_name,
      brand_id:      a.brand_id,
      brand_name:    a.brand_name,
      track:         a.set_goal === 'engagement' ? 'content' : (a.set_goal === 'hybrid' ? 'both' : 'sales'),
      step:          derived.step,
      step_label:    step.STEP_LABEL[derived.step] || null,
      turn:          derived.turn,
      closed:        !!derived.closed,
      own:           step.owes(derived, step.TURN.YOU_CREATOR),
    };
  });
}

module.exports = { forBrand, forCreator, stepsForCreator };
