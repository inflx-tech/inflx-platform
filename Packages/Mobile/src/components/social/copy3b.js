/**
 * Item 3b — every label and sentence the social-numbers screens show (prompt §5, §6).
 * Server mirror: backend/src/services/socialCopy.js. Contract: features/item3b-social-numbers
 */

export const MSG3B = {
  INSTAGRAM_INVALID: 'Enter a valid Instagram username.',
  YOUTUBE_INVALID: 'Enter a YouTube handle or channel link.',
  AT_LEAST_ONE: 'Add at least one account.',
  LAST_ACCOUNT: 'Keep at least one account.',
  CHECK_AGAIN_LIMIT: 'You can check again once a day.',
};

export const PLATFORM_LABEL = { instagram: 'Instagram', youtube: 'YouTube' };

export const C3B = {
  s1: {
    igSub: (type) => (type ? `Instagram · ${type}` : 'Instagram'),
    ytSub: 'YouTube',
    igTiles: ['Engagement', 'Avg reel views', 'Recent posts'],
    ytTiles: ['Avg video views', 'Avg shorts views', 'Recent uploads'],
    noPosts: (followers) => `No posts in the last 90 days. Followers: ${followers}.`,
    updating: ['Numbers are being updated', 'Check back later.'],
    unavailableSub: 'Numbers not available',
    unavailableBox: "INFLX can't measure this account right now.",
    stale: (d) => `Updated ${d}`,
  },
  detail: {
    open: 'Open', profile: 'PROFILE', channel: 'CHANNEL', last90: 'RECENT POSTS', last90yt: 'RECENT UPLOADS', long: 'LONG VIDEOS', shorts: 'SHORTS',
    inWindow: (n) => `${n} measured`,
    followers: 'Followers', following: 'Following', totalPosts: 'Total posts',
    subscribers: 'Subscribers', totalVideos: 'Total videos', totalViews: 'Total views',
    engagement: 'Engagement', avgLikes: 'Avg likes', avgComments: 'Avg comments', avgReelViews: 'Avg reel views', avgViews: 'Avg views',
    postsTile: (perWeek) => `Posts · ${perWeek} a week`,
    uploadsLine: (n, perWeek) => `${n} uploads · ${perWeek} a week`,
    lastPost: (d) => `Last post ${d}`, lastUpload: (d) => `Last upload ${d}`,
    reels: (n) => `${n} reels`, photos: (n) => `${n} photos`, carousels: (n) => `${n} carousels`,
    igFormula: 'Engagement = likes + comments ÷ views, across the reels measured. Reels are the only Instagram format with a view count.',
    igFormulaFollowers: 'Engagement = average likes + comments per post ÷ followers. Used here because there were no reels to measure views on.',
    measuredOf: (n) => `Worked out from her ${n} most recent posts.`,
    hidden: (n) => (n === 1 ? "1 post hides likes and isn't in the likes average." : `${n} posts hide likes and aren't in the likes average.`),
    ytFormula: "Engagement = likes + comments ÷ views, worked out separately for long videos and shorts. Shorts count a view as soon as they play, so their rate is usually lower. Live streams aren't counted.",
    igFooter: (f, p) => `Measured by INFLX · followers ${f} · posts ${p}`,
    ytFooter: (s, u) => `Measured by INFLX · subscribers ${s} · uploads ${u}`,
    accountLine: (type, name) => `${type} · ${name}`,
    channelLine: (name) => `${name} · channel`,
  },
  r1: {
    title: 'Your social accounts',
    intro: 'INFLX measures your public numbers from these accounts. Brands see them on your profile.',
    ig: 'Instagram username', yt: 'YouTube handle or channel link',
    hint: 'Add at least one. Your account must be public. We measure your numbers after INFLX approves your profile.',
    continue: 'Continue',
    step1Title: 'Set up your profile', step1Lede: 'A few quick details so we can verify your account and match you with brands.',
  },
  r3: {
    row: 'Your numbers',
    sub: (parts) => parts.join(' · '),
    chips: { fix_instagram: 'Fix Instagram', fix_youtube: 'Fix YouTube', fix_accounts: 'Fix accounts', waiting: 'Waiting', measuring: 'Measuring' },
  },
  r4: {
    title: 'Your numbers',
    info: 'Brands see these numbers on your profile. Followers update every week; posts every 15 days.',
    igTiles: ['Followers', 'Engagement', 'Recent posts'],
    ytTiles: ['Subscribers', 'Avg video views', 'Avg shorts views'],
    igLine: (f, p, n) => `Followers ${f} · posts ${p} · next posts update ${n}`,
    ytLine: (s, u, n) => `Subscribers ${s} · uploads ${u} · next uploads update ${n}`,
    hint: "Numbers are read from your public accounts and can't be typed in. To change an account, edit Profile info.",
  },
  r5: {
    waitingApproval: ['Waiting for INFLX approval', 'We measure your numbers after INFLX approves your profile.'],
    waitingCheck: ['INFLX is checking this account is yours', "We'll measure it once it's confirmed. This usually takes up to a day."],
    measuring: (p) => [`Measuring your ${p}`, 'This usually takes a few minutes.'],
    notFound: (h, p) => [`We couldn't find @${h} on ${p}`, 'Check the spelling in Profile info.'],
    private: (p) => [`Your ${p === 'Instagram' ? 'account' : 'channel'} isn't public`, "Brands can't see your numbers until it is."],
    rejected: (h) => [`INFLX couldn't confirm @${h} is yours`, 'Add the account that belongs to you in Profile info.'],
    failing: "We couldn't refresh your numbers lately. We'll keep trying.",
    notAdded: 'Not added', fixUsername: 'Fix username', checkAgainPublic: "It's public now, check again", checkAgain: 'Check again',
    onceADay: 'You can check again once a day.', add: (p) => `Add ${p}`,
  },
  r6: {
    changeTitle: (p) => `Change your ${p} account?`,
    changeBody: (p, h) => `Your current ${p} numbers will be removed from your profile. INFLX will check @${h} belongs to you, then measure it. Brands see "Numbers are being updated" until then.`,
    change: 'Change account',
    addTitle: (p) => `Add your ${p} account?`, addBody: (h) => `INFLX will check @${h} belongs to you, then measure it.`, add: 'Add account',
    removeTitle: (p) => `Remove your ${p} account?`, removeBody: 'Its numbers will be removed from your profile.', remove: 'Remove',
    cancel: 'Cancel',
  },
  states: { loadTitle: "Couldn't load these numbers", loadBody: 'Check your connection and try again.', tryAgain: 'Try again' },
};

/** Device-side format checks (the server checks again with the same messages). */
export function validInstagram(raw) {
  let s = String(raw || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/^@+/, '').toLowerCase();
  if (s.includes('/')) s = s.split('/')[0];
  return /^[a-z0-9._]{1,30}$/.test(s) ? s : null;
}
export function validYoutube(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  const url = s.match(/^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/(.+)$/i);
  if (url) s = url[1];
  s = s.split(/[?#]/)[0].replace(/\/+$/, '');
  if (/^channel\/UC[\w-]{20,}$/i.test(s) || /^UC[\w-]{20,}$/.test(s)) return s.replace(/^channel\//i, '');
  const legacy = s.match(/^(?:user|c)\/([A-Za-z0-9._-]{1,100})$/i);
  if (legacy) return legacy[1].toLowerCase();
  const h = s.replace(/^@+/, '').split('/')[0].toLowerCase();
  return /^[a-z0-9._-]{3,60}$/.test(h) ? h : null;
}
