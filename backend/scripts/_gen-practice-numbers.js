/**
 * Draft the practice-cast numbers as a CSV, for review BEFORE anything is written.
 * Contract: features/practice-creator-numbers
 *
 * Every number is derived, not typed, so the set is internally consistent with the app's own
 * formulas (socialCalc.service.js): Instagram engagement is (likes + comments) / reel views,
 * which is what item 3b measures and what the real scraped account reads 5.1% on.
 */
const fs = require('fs');
const path = require('path');

const r1 = (n) => Math.round(n * 10) / 10;
const ri = (n) => Math.round(n);

/** Deterministic pseudo-random in [0,1) from a string — same CSV every run. */
function rand(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}
const between = (seed, lo, hi) => lo + rand(seed) * (hi - lo);

/**
 * The cast. Phone + name are what exists; everything else is the spread we are choosing.
 * Cities are Telangana and Andhra Pradesh only, with their real ref_cities ids.
 * Tier bands: nano 1k–10k · micro 10k–100k · macro 100k–500k · mega 500k+
 */
const CAST = [
  // phone-suffix, name, gender, tier, city, city_id, niche, languages
  ['110', 'Asha M.',    'female', 'micro', 'Vijayawada',    2,  'fashion',   ['Telugu', 'English']],
  ['111', 'Meera S.',   'female', 'micro', 'Hyderabad',     11, 'fashion',   ['Telugu', 'Hindi']],
  ['112', 'Divya T.',   'female', 'nano',  'Guntur',        3,  'fashion',   ['Telugu']],
  ['113', 'Nisha P.',   'female', 'macro', 'Hyderabad',     11, 'lifestyle', ['Telugu', 'English', 'Hindi']],
  ['114', 'Karthik V.', 'male',   'micro', 'Guntur',        3,  'fitness',   ['Telugu', 'English']],
  ['115', 'Ravi K.',    'male',   'nano',  'Nellore',       4,  'fitness',   ['Telugu']],
  ['116', 'Priya N.',   'female', 'macro', 'Visakhapatnam', 1,  'fashion',   ['Telugu', 'English']],
  ['117', 'Sneha R.',   'female', 'micro', 'Visakhapatnam', 1,  'beauty',    ['Telugu', 'Hindi']],
  ['118', 'Lakshmi D.', 'female', 'nano',  'Nellore',       4,  'beauty',    ['Telugu']],
  ['119', 'Anita B.',   'female', 'mega',  'Hyderabad',     11, 'fashion',   ['Telugu', 'English', 'Hindi']],
  ['120', 'Rohit S.',   'male',   'micro', 'Hyderabad',     11, 'lifestyle', ['Telugu', 'English']],
  ['121', 'Kavya J.',   'female', 'macro', 'Hyderabad',     11, 'fashion',   ['Telugu', 'English']],
  ['122', 'Tejas M.',   'male',   'nano',  'Warangal',      12, 'fitness',   ['Telugu']],
  ['123', 'Deepa K.',   'female', 'micro', 'Karimnagar',    13, 'fashion',   ['Telugu', 'Hindi']],
  ['124', 'Arjun P.',   'male',   'mega',  'Hyderabad',     11, 'fitness',   ['Telugu', 'English', 'Hindi']],
  ['125', 'Nandini G.', 'female', 'micro', 'Tirupati',      5,  'beauty',    ['Telugu', 'English']],
  ['126', 'Vikram L.',  'male',   'nano',  'Kurnool',       6,  'fitness',   ['Telugu']],
  ['127', 'Ishita C.',  'female', 'macro', 'Vijayawada',    2,  'beauty',    ['Telugu', 'Tamil']],
  ['128', 'Manoj T.',   'male',   'micro', 'Rajahmundry',   7,  'lifestyle', ['Telugu', 'English']],
  ['129', 'Pooja V.',   'female', 'mega',  'Visakhapatnam', 1,  'fashion',   ['Telugu', 'English']],
  ['130', 'Rahul N.',   'male',   'nano',  'Kakinada',      8,  'lifestyle', ['Telugu']],
  ['131', 'Sita A.',    'female', 'macro', 'Warangal',      12, 'beauty',    ['Telugu', 'English']],
];

/** Followers, engagement and how far a reel travels, by band. Engagement falls as reach grows. */
const BAND = {
  nano:  { f: [2200, 9400],     er: [7.0, 9.4], viewX: [2.5, 5.0],  subX: [0.18, 0.35], posts: [6, 14] },
  micro: { f: [14000, 88000],   er: [4.6, 6.9], viewX: [4.0, 8.0],  subX: [0.20, 0.40], posts: [9, 22] },
  macro: { f: [128000, 470000], er: [2.3, 4.4], viewX: [8.0, 15.0], subX: [0.22, 0.45], posts: [12, 28] },
  mega:  { f: [720000, 2400000],er: [1.3, 2.2], viewX: [11.0, 18.0],subX: [0.15, 0.30], posts: [14, 30] },
};

const rows = [];
for (const [suffix, name, gender, tier, city, cityId, niche, langs] of CAST) {
  const b = BAND[tier];
  const s = (k) => suffix + k;

  const followers  = ri(between(s('f'), b.f[0], b.f[1]) / 100) * 100;
  const engagement = r1(between(s('e'), b.er[0], b.er[1]));
  const reelViews  = ri(followers * between(s('v'), b.viewX[0], b.viewX[1]));

  // The app's own formula, backwards: engagement = (likes + comments) / views × 100.
  const interactions = reelViews * engagement / 100;
  const avgLikes    = r1(interactions * 0.99);
  const avgComments = r1(interactions * 0.01);

  const posts90 = ri(between(s('p'), b.posts[0], b.posts[1]));
  const reels   = ri(posts90 * between(s('r'), 0.6, 0.85));
  const photos  = ri((posts90 - reels) * 0.4);
  const carousels = posts90 - reels - photos;
  const totalPosts = ri(posts90 * between(s('t'), 4, 11));
  const following  = ri(between(s('g'), 180, 1400));

  const subscribers = ri(followers * between(s('s'), b.subX[0], b.subX[1]) / 100) * 100;
  const videos      = ri(between(s('n'), 18, 140));
  const longCount   = ri(videos * between(s('l'), 0.25, 0.5));
  const shortCount  = videos - longCount;
  const longViews   = ri(subscribers * between(s('lv'), 1.2, 4.5));
  const shortViews  = ri(subscribers * between(s('sv'), 3.0, 12.0));
  const longEng     = r1(between(s('le'), 1.1, 3.4));
  const shortEng    = r1(between(s('se'), 1.6, 4.2));
  const channelViews = ri(longViews * longCount + shortViews * shortCount);

  rows.push({
    phone: '+917900000' + suffix,
    name: name + ' (practice)',
    gender, tier, city, city_id: cityId, niche,
    languages: langs.join('|'),
    ig_handle: name.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '') + '_practice',
    ig_followers: followers,
    ig_engagement_pct: engagement,
    ig_avg_reel_views: reelViews,
    ig_avg_likes: avgLikes,
    ig_avg_comments: avgComments,
    ig_posts_90d: posts90,
    ig_reels: reels,
    ig_photos: photos,
    ig_carousels: carousels,
    ig_total_posts: totalPosts,
    ig_following: following,
    ig_verified: tier === 'mega' || tier === 'macro' ? 'true' : 'false',
    yt_handle: name.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '') + 'practice',
    yt_subscribers: subscribers,
    yt_videos: videos,
    yt_channel_views: channelViews,
    yt_long_count: longCount,
    yt_long_avg_views: longViews,
    yt_long_engagement_pct: longEng,
    yt_short_count: shortCount,
    yt_short_avg_views: shortViews,
    yt_short_engagement_pct: shortEng,
  });
}

const cols = Object.keys(rows[0]);
const csv = [cols.join(','), ...rows.map(r => cols.map(c => r[c]).join(','))].join('\n') + '\n';
const out = path.join(__dirname, '..', 'seeds', 'practice_creator_numbers.csv');
fs.writeFileSync(out, csv);
console.log('written:', out, '·', rows.length, 'creators');

// A readable summary for the founder.
const by = (k) => rows.reduce((m, r) => (m[r[k]] = (m[r[k]] || 0) + 1, m), {});
console.log('\nby tier:', JSON.stringify(by('tier')));
console.log('by niche:', JSON.stringify(by('niche')));
console.log('by city:', JSON.stringify(by('city')));
const langCount = {};
for (const r of rows) for (const l of r.languages.split('|')) langCount[l] = (langCount[l] || 0) + 1;
console.log('by language:', JSON.stringify(langCount));
console.log('\nname                | tier  | city          | niche     | IG followers | ER%  | YT subs');
for (const r of rows) {
  console.log(' ', r.name.replace(' (practice)', '').padEnd(18), '|', r.tier.padEnd(5), '|', r.city.padEnd(13), '|',
    r.niche.padEnd(9), '|', String(r.ig_followers).padStart(12), '|', String(r.ig_engagement_pct).padStart(4), '|', String(r.yt_subscribers).padStart(8));
}
