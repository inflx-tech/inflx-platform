// post-links-codes — inflx.in/c/<code>: a collection's one link (§4.14).
import { lookup, Frame, Notice, Collection, WORDS } from '../../../components/links/linkPages';

export const dynamic = 'force-dynamic';
const pathOf = (params) => `/links/c/${encodeURIComponent(params.code)}`;

export async function generateMetadata({ params }) {
  const d = await lookup(pathOf(params));
  const title = d && d.name ? `${d.name} · INFLX` : 'INFLX';
  return { title, robots: { index: false }, openGraph: { title } };
}

export default async function CollectionLinkPage({ params }) {
  const d = await lookup(pathOf(params));
  if (!d || d.state === 'unknown') return <Frame><Notice title={WORDS.collectionUnknown} /></Frame>;
  if (d.state === 'hidden') return <Frame><Notice title={WORDS.collectionHidden} sub={d.name} store={d.store} /></Frame>;
  return <Frame><Collection data={d} /></Frame>;
}
