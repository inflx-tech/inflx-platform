// post-links-codes — inflx.in/s/<handle>/<ig|yt|wa|fb|o>: her store link; an old handle still opens it (§4.14).
import { lookup, Frame, Notice, Store, WORDS } from '../../../../components/links/linkPages';

export const dynamic = 'force-dynamic';
const pathOf = (params) => `/links/s/${encodeURIComponent(params.handle)}?ch=${encodeURIComponent((params.ch && params.ch[0]) || '')}`;

export async function generateMetadata({ params }) {
  const d = await lookup(pathOf(params));
  const title = d && d.store ? `${d.store.name} on INFLX` : 'INFLX';
  return { title, robots: { index: false }, openGraph: { title } };
}

export default async function StoreLinkPage({ params }) {
  const d = await lookup(pathOf(params));
  if (!d || d.state === 'unknown') return <Frame><Notice title={WORDS.storeUnknown} /></Frame>;
  return <Frame><Store data={d} /></Frame>;
}
