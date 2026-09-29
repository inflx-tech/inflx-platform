// post-links-codes — inflx.in/p/<code>/<ig|yt|wa|fb|o>: a post link (rules §4.14, spec D7).
import { lookup, Frame, Notice, PostCard, StoreLink, WORDS } from '../../../../components/links/linkPages';

export const dynamic = 'force-dynamic';
const pathOf = (params) => `/links/p/${encodeURIComponent(params.code)}?ch=${encodeURIComponent((params.ch && params.ch[0]) || '')}`;

export async function generateMetadata({ params }) {
  const d = await lookup(pathOf(params));
  const title = d && d.post && d.post.title ? `${d.post.title} · INFLX` : 'INFLX';
  return { title, robots: { index: false }, openGraph: { title, images: d && d.post && d.post.cover && d.post.cover.kind !== 'video' ? [d.post.cover.url] : [] } };
}

export default async function PostLinkPage({ params }) {
  const d = await lookup(pathOf(params));
  if (!d || d.state === 'unknown') return <Frame><Notice title={WORDS.unknown} sub={WORDS.unknownSub} /></Frame>;
  if (d.state === 'upcoming') return <Frame><Notice tone="soon" title={WORDS.goesLive(d.goes_live_on)} sub={WORDS.goesLiveSub} store={d.store} /></Frame>;
  if (d.state === 'gone') return <Frame><Notice title={WORDS.gone} sub={WORDS.goneSub} store={d.store} /></Frame>;
  return <Frame><PostCard post={d.post} creator={d.creator} /><StoreLink store={d.store} /></Frame>;
}
