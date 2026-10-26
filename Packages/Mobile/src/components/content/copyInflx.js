/**
 * post-engagement-stats — the words of the "In INFLX" block and line, and of the Comments screen,
 * as the board gives them (spec §4). Numbers in full with Indian grouping (Level 2's M1).
 * Contract: features/post-engagement-stats · rules §4.15
 */
import { indian } from './copyStats';
import { day10 } from '../shoot/copy10';

export const INFLX = {
  header: 'In INFLX',
  views: 'views', likes: 'likes', comments: 'comments', shares: 'shares', saves: 'saves',
  shopTaps: 'shop taps', bagAdds: 'added to bag', finished: 'finished',
  hint: (since) => `Shoppers inside INFLX${since ? ` since ${day10(since)}` : ''}. Guests count for views, shares and taps; likes, comments and saves need an account.`,
  nothingYet: 'In INFLX · nothing yet',
  // the Comments screen (C5, B5)
  title: (postTitle) => `Comments · ${postTitle}`,
  sub: (n) => `${indian(n)} ${n === 1 ? 'comment' : 'comments'} · newest first`,
  readOnly: (name) => `Only ${name || 'the creator'} can reply or hide`,
  reply: 'Reply', hide: 'Hide', unhide: 'Unhide', you: 'You', creatorTag: 'creator',
  hiddenLine: 'Hidden · only you see this',
  replyAs: (name) => `Reply as ${name || 'you'}…`,
  send: 'Send', cancel: 'Cancel',
  counter: (n) => `${n}/300`,
  none: 'No comments yet.',
};

/** "In INFLX · 1,840 views · 212 likes · 38 comments", or the grey "nothing yet" when all three are 0. */
export function inflxLine(three) {
  if (!three) return null;
  const { views = 0, likes = 0, comments = 0 } = three;
  if (!views && !likes && !comments) return { text: INFLX.nothingYet, empty: true };
  return { text: `${INFLX.header} · ${indian(views)} ${INFLX.views} · ${indian(likes)} ${INFLX.likes} · ${indian(comments)} ${INFLX.comments}`, empty: false };
}

export default INFLX;
