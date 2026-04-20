'use strict';

const db = require('../config/db');

/**
 * Get full engagement analytics for a campaign (brand view).
 */
async function getCampaignEngagement(campaignId) {
  // Verify campaign exists
  const { rows: campRows } = await db.query(
    `SELECT c.id, c.name, c.start_date, c.end_date
     FROM campaigns c
     WHERE c.id = $1`,
    [campaignId]
  );
  if (!campRows[0]) return null;
  const campaign = campRows[0];

  // Pull every deliverable for the campaign + its stats + set it lives in.
  // We include deliverables in ANY status (not just 'live') so the Analytics
  // tab can report deliverable counts (awaiting review / in revision / live)
  // alongside performance metrics for live ones.
  const { rows: infRows } = await db.query(
    `SELECT
       ci.id  AS campaign_influencer_id,
       cs.id  AS set_id,
       cs.name AS set_name,
       cs.goal AS set_goal,
       i.id AS influencer_id,
       u.name,
       i.instagram_handle AS handle,
       i.followers_count,
       ds.reach, ds.impressions, ds.likes, ds.comments, ds.saves, ds.shares,
       ds.engagement_rate, ds.scraped_at,
       d.id AS deliverable_id, d.type AS deliverable_type, d.live_url, d.status AS deliverable_status
     FROM campaign_sets cs
     JOIN campaign_influencers ci ON ci.set_id = cs.id
     JOIN influencers i ON i.id = ci.influencer_id
     JOIN users u ON u.id = i.user_id
     LEFT JOIN deliverables d ON d.campaign_influencer_id = ci.id
     LEFT JOIN deliverable_stats ds ON ds.deliverable_id = d.id
     WHERE cs.campaign_id = $1`,
    [campaignId]
  );

  // Aggregate by influencer — only 'live' deliverables contribute performance
  // numbers. Other statuses still surface in the per-influencer deliverables
  // list so the UI can show status pills. "Views" is Apify's video-view count
  // for reels (stored in the impressions column); only counted when the type
  // is 'reel' to avoid polluting the metric with post "impressions" which
  // public scraping cannot actually return.
  const influencerMap = {};
  const seenDeliverables = new Set();
  for (const row of infRows) {
    if (!influencerMap[row.influencer_id]) {
      influencerMap[row.influencer_id] = {
        influencer_id: row.influencer_id,
        set_id:        row.set_id,
        set_name:      row.set_name,
        set_goal:      row.set_goal,
        name:          row.name,
        handle:        `@${row.handle}`,
        instagram_handle: row.handle,
        followers:     parseInt(row.followers_count) || 0,
        likes: 0, comments: 0, views: 0,
        engagement_rate: 0,
        deliverables: [],
      };
    }
    const inf = influencerMap[row.influencer_id];

    const isLive    = row.deliverable_status === 'live';
    const isReel    = row.deliverable_type   === 'reel';
    const likes     = parseInt(row.likes    || 0);
    const comments  = parseInt(row.comments || 0);
    const views     = parseInt(row.impressions || 0); // reel view count lives here

    if (isLive) {
      inf.likes    += likes;
      inf.comments += comments;
      if (isReel) inf.views += views;
    }

    if (row.deliverable_id && !seenDeliverables.has(row.deliverable_id)) {
      seenDeliverables.add(row.deliverable_id);
      inf.deliverables.push({
        id:        row.deliverable_id,
        type:      row.deliverable_type,
        status:    row.deliverable_status,
        live_url:  row.live_url,
        likes:     likes,
        comments:  comments,
        views:     isReel ? views : null,
        engagement_rate: row.engagement_rate != null ? parseFloat(row.engagement_rate) : null,
        scraped_at: row.scraped_at,
      });
    }
  }

  // Per-influencer ER: recompute from aggregated likes+comments over
  // followers. Matches how a brand thinks about it ("what % of this
  // influencer's audience engaged with the content we paid for") and stays
  // correct as more deliverables go live. Falls back to 0 when followers is
  // unknown.
  for (const inf of Object.values(influencerMap)) {
    inf.engagement_rate = inf.followers > 0
      ? parseFloat((((inf.likes + inf.comments) / inf.followers) * 100).toFixed(2))
      : 0;
  }

  const byInfluencer = Object.values(influencerMap);

  // Totals — honest metrics only. Reach / impressions / saves / shares aren't
  // available from Apify's public scraper so we don't aggregate or surface
  // them at campaign level.
  const totalLikes    = byInfluencer.reduce((s, i) => s + i.likes,    0);
  const totalComments = byInfluencer.reduce((s, i) => s + i.comments, 0);
  const totalViews    = byInfluencer.reduce((s, i) => s + i.views,    0);
  const avgEr         = byInfluencer.length > 0
    ? parseFloat((byInfluencer.reduce((s, i) => s + i.engagement_rate, 0) / byInfluencer.length).toFixed(2))
    : 0;

  // Per-set rollup derived from the influencer map so the UI can show
  // by-set totals without a second round-trip.
  const setMap = {};
  for (const inf of byInfluencer) {
    if (!setMap[inf.set_id]) {
      setMap[inf.set_id] = {
        set_id:   inf.set_id,
        set_name: inf.set_name,
        goal:     inf.set_goal,
        influencers: 0,
        likes: 0, comments: 0, views: 0,
        engagement_rate: 0,
      };
    }
    const s = setMap[inf.set_id];
    s.influencers += 1;
    s.likes       += inf.likes;
    s.comments    += inf.comments;
    s.views       += inf.views;
  }
  for (const s of Object.values(setMap)) {
    const infs = byInfluencer.filter(i => i.set_id === s.set_id);
    s.engagement_rate = infs.length > 0
      ? parseFloat((infs.reduce((a, i) => a + i.engagement_rate, 0) / infs.length).toFixed(2))
      : 0;
  }
  const bySet = Object.values(setMap);

  return {
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    date_range: { start: campaign.start_date, end: campaign.end_date },
    totals: {
      total_likes:    totalLikes,
      total_comments: totalComments,
      total_views:    totalViews,
      avg_er:         avgEr,
    },
    by_set:        bySet,
    by_influencer: byInfluencer,
  };
}

module.exports = { getCampaignEngagement };
