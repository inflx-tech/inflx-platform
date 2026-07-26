/* Pure social-stats aggregation for the Tracking screen
   (features/tracking-social). Sums engagement counts across a collab's live
   deliverables and averages engagement-rate over the posts that report it. */

const COUNT_FIELDS = ['likes', 'comments', 'saves', 'shares', 'reach', 'impressions'];

export function aggregateSocialStats(list = []) {
  const rows = (list || []).filter(Boolean);
  const out = { postCount: rows.length };
  for (const f of COUNT_FIELDS) out[f] = 0;

  let erSum = 0, erCount = 0;
  for (const s of rows) {
    for (const f of COUNT_FIELDS) {
      const n = Number(s?.[f]);
      if (!Number.isNaN(n)) out[f] += n;
    }
    const er = s?.engagement_rate;
    if (er != null && !Number.isNaN(Number(er))) { erSum += Number(er); erCount += 1; }
  }
  out.avgEngagementRate = erCount > 0 ? erSum / erCount : null;
  return out;
}
