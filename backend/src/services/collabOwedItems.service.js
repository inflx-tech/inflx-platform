'use strict';

/**
 * collabOwedItems.service.js — what is owed at a level that belongs to no creator.
 * Contract: features/stage-3-watch-the-work-happen (slice 1)
 * Board: 04-preview/mockups/stage3-screens.html panels ③ and ④ · FINAL 4
 *
 * WHY THIS IS ITEMS AND NOT A NUMBER
 * collabCounts already counted ONE set-level thing — creators with no allocation — as a
 * bare integer. A bare integer is a badge you cannot walk down. FINAL 4's rule is that
 * tapping a 6 gets you to a button, every time, and a screen cannot name what it was never
 * told.
 *
 * So every level now returns a LIST, and its `own` is that list's length. The badge and the
 * list are the same fact, which means they cannot disagree — the same reason publishGate
 * returns blockers rather than a boolean.
 *
 * WHAT IS DELIBERATELY NOT COUNTED, AND WHY
 *   · An expiring OFFER. campaign_influencers.offer_valid_until and
 *     brand_offers.store_ends_at both exist, so this IS computable — the older comment in
 *     collabCounts saying otherwise is stale. But checked against production 2026-08-26:
 *     0 of 6 collaborations and 0 of 1 offers carry a deadline, because nothing writes one
 *     and the phone's offer builder cannot set one (Stage 2 punch list). It is implemented
 *     below and will honestly return nothing until offers gain deadlines. Counting zero is
 *     honest; not implementing it and calling it impossible is not.
 *
 * Read-only. Takes its connection so the rules can be executed in a test without a database.
 */

const SELLING_GOALS = ['conversion', 'hybrid'];
const PAID_GOALS = ['engagement', 'hybrid'];

/** A creator row that is out of the running owes nothing and is owed nothing. */
const DEAD_STATUSES = ['declined', 'expired', 'rejected_by_brand', 'slots_filled'];

/**
 * A sales campaign that has been running a while and sold nothing is worth surfacing —
 * but only once the work has actually happened. Firing it on every campaign the day after
 * it starts would train a brand to ignore the number, which costs more than the item is
 * worth. So it needs BOTH: thirty days of running, AND a creator who has got past the
 * shoot. Nothing is broken; nothing is happening.
 */
const QUIET_SALES_DAYS = 30;

/** Within this many days of lapsing counts as "expiring", matching the agreements rule. */
const EXPIRING_SOON_DAYS = 14;

const item = (code, message, extra) => ({ code, message, ...(extra || {}) });

/**
 * Owed items for every SET belonging to this brand's live campaigns.
 * @returns Map(set_id -> item[])
 */
async function forSets(brandId, conn) {
  const { rows } = await conn.query(
    `SELECT cs.id   AS set_id,
            cs.name AS set_name,
            cs.goal,
            COALESCE(cs.influencer_mode, 'handpick') AS influencer_mode,

            -- Creators contracted into a selling set with nothing to sell. Since Part 4,
            -- having something to sell is the gate for appearing in the shopping app at
            -- all, so these people are contracted and invisible.
            (SELECT count(*)::int FROM campaign_influencers ci
              WHERE ci.set_id = cs.id
                AND cs.goal <> 'engagement'
                AND ci.alloc_scope IS NULL
                AND ci.status <> ALL($2::campaign_influencer_status[]))  AS without_allocation,

            -- Anyone at all in it.
            (SELECT count(*)::int FROM campaign_influencers ci
              WHERE ci.set_id = cs.id
                AND ci.status <> ALL($2::campaign_influencer_status[]))  AS members,

            -- A creator whose campaign-level offer has a deadline that is near or past.
            (SELECT count(*)::int FROM campaign_influencers ci
              WHERE ci.set_id = cs.id
                AND ci.status <> ALL($2::campaign_influencer_status[])
                AND ci.offer_valid_until IS NOT NULL
                AND ci.offer_valid_until < now() + ($3 || ' days')::interval) AS offers_expiring,

            -- Products a shopper could actually buy from this brand. A selling set whose
            -- brand lists nothing sends every creator's traffic to an empty shelf.
            (SELECT count(*)::int FROM brand_products bp
              WHERE bp.brand_id = cam.brand_id
                AND bp.is_active = true
                AND (bp.stock IS NULL OR bp.stock > 0))                  AS live_products
       FROM campaign_sets cs
       JOIN campaigns cam ON cam.id = cs.campaign_id
      WHERE cam.brand_id = $1
        AND cam.status NOT IN ('cancelled', 'completed')`,
    [brandId, DEAD_STATUSES, String(EXPIRING_SOON_DAYS)]
  );

  const out = new Map();
  for (const r of rows) {
    const items = [];
    const selling = SELLING_GOALS.includes(r.goal);
    const n = Number(r.without_allocation || 0);

    if (n > 0) {
      items.push(item('NO_ALLOCATION', plural(n,
        'creator has nothing to sell', 'creators have nothing to sell'
      ) + ' — they are contracted and invisible in the shopping app.', { count: n, set_id: r.set_id }));
    }

    // An empty set is a set that was built and left. It is not a refusal to publish —
    // Stage 2 learned that lesson — but it is worth telling someone about.
    if (Number(r.members || 0) === 0 && r.influencer_mode === 'handpick') {
      items.push(item('EMPTY_SET', 'Nobody is in this set yet.', { set_id: r.set_id }));
    }

    // Only a SELLING set can have an empty shelf problem — a content set sells nothing.
    if (selling && Number(r.members || 0) > 0 && Number(r.live_products || 0) === 0) {
      items.push(item('NOTHING_TO_BUY',
        'Nothing in your store is live and in stock, so traffic from this set lands nowhere.',
        { set_id: r.set_id }));
    }

    const exp = Number(r.offers_expiring || 0);
    if (exp > 0) {
      items.push(item('OFFER_EXPIRING', plural(exp,
        'creator\'s offer is about to run out', 'creators\' offers are about to run out'
      ) + ' — when it does, a shopper loses the reason to buy through them.', { count: exp, set_id: r.set_id }));
    }

    out.set(r.set_id, items);
  }
  return out;
}

/**
 * Owed items for every CAMPAIGN belonging to this brand.
 * @returns Map(campaign_id -> item[])
 */
async function forCampaigns(brandId, conn) {
  const { rows } = await conn.query(
    `SELECT cam.id AS campaign_id,
            cam.name,
            cam.status,
            cam.total_budget,
            cam.published_at,
            cam.start_date,
            b.wallet_balance,

            (SELECT count(*)::int FROM campaign_sets cs
              WHERE cs.campaign_id = cam.id)                              AS sets,
            (SELECT count(*)::int FROM campaign_sets cs
              WHERE cs.campaign_id = cam.id AND cs.goal = ANY($3))        AS paid_sets,
            (SELECT count(*)::int FROM campaign_sets cs
              WHERE cs.campaign_id = cam.id AND cs.goal = ANY($4))        AS selling_sets,
            (SELECT count(*)::int FROM campaign_influencers ci
               JOIN campaign_sets cs ON cs.id = ci.set_id
              WHERE cs.campaign_id = cam.id
                AND ci.status <> ALL($2::campaign_influencer_status[]))   AS members,

            -- Has anyone actually got past the shoot? A campaign that sold nothing while
            -- nothing was ever posted is not quiet, it is early.
            (SELECT count(*)::int FROM campaign_influencers ci
               JOIN campaign_sets cs ON cs.id = ci.set_id
              WHERE cs.campaign_id = cam.id
                AND ci.status IN ('active', 'completed'))                 AS working,

            (SELECT count(*)::int FROM follower_transactions ft
              WHERE ft.campaign_id = cam.id)                              AS sales
       FROM campaigns cam
       JOIN brands b ON b.id = cam.brand_id
      WHERE cam.brand_id = $1
        AND cam.status NOT IN ('cancelled', 'completed')`,
    [brandId, DEAD_STATUSES, PAID_GOALS, SELLING_GOALS]
  );

  const out = new Map();
  for (const r of rows) {
    const items = [];

    // A content set cannot publish until the wallet covers its fees. Only meaningful while
    // there IS a fee to cover — a sales-only campaign holds nothing.
    const required = Number(r.total_budget || 0);
    const balance = Number(r.wallet_balance || 0);
    if (Number(r.paid_sets || 0) > 0 && required > 0 && balance < required) {
      items.push(item('WALLET_SHORT',
        `Your wallet is short by ₹${(required - balance).toFixed(2)} for this campaign.`,
        { campaign_id: r.campaign_id, required, balance, short: required - balance }));
    }

    // Built and left in a drawer. Only worth saying once there is something to publish —
    // a shell with no sets is a campaign someone is still writing.
    if (r.status === 'draft' && Number(r.sets || 0) > 0 && Number(r.members || 0) > 0) {
      items.push(item('NEVER_PUBLISHED',
        'This campaign is ready but was never published, so nobody has been invited.',
        { campaign_id: r.campaign_id }));
    }

    // Nothing is broken, but nothing is happening. Deliberately narrow — see the note on
    // QUIET_SALES_DAYS. Both conditions, or it fires on every young campaign at once.
    if (Number(r.selling_sets || 0) > 0 && Number(r.sales || 0) === 0 && Number(r.working || 0) > 0) {
      const since = r.published_at || r.start_date;
      if (since && daysSince(since) >= QUIET_SALES_DAYS) {
        items.push(item('QUIET_SALES',
          `${QUIET_SALES_DAYS} days of selling and no sale yet. Nothing is broken — worth a look at the offer, or what they can sell.`,
          { campaign_id: r.campaign_id, days: daysSince(since) }));
      }
    }

    out.set(r.campaign_id, items);
  }
  return out;
}

function daysSince(d) {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

module.exports = {
  forSets,
  forCampaigns,
  SELLING_GOALS,
  PAID_GOALS,
  DEAD_STATUSES,
  QUIET_SALES_DAYS,
  EXPIRING_SOON_DAYS,
};
