// post-links-codes (Level 4) — what inflx.in/p/<code>, /s/<handle> and /c/<code> open.
// Contract: features/post-links-codes · rules §4.14 · spec D7
//
// Until the shopper app, a link opens a plain INFLX page: what the post (or store, or collection)
// is, never a checkout. Every link lands somewhere: a post that isn't live yet says when it will be,
// and one that left the shop — or a code nobody has — says so and points to her store.
// The server records the visit (and ignores link previews); this page only passes on the visitor's
// browser and where they came from.

import { cache } from 'react';
import { headers } from 'next/headers';

const API = () => (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1').replace(/\/+$/, '');
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || '';

/** One lookup per request, shared by the page and its preview metadata (so a tap counts once). */
export const lookup = cache(async (path) => {
  const h = headers();
  try {
    const r = await fetch(`${API()}${path}`, {
      cache: 'no-store',
      headers: { 'x-visitor-ua': h.get('user-agent') || '', 'x-visitor-referer': h.get('referer') || '' },
    });
    const j = await r.json();
    return j && j.success ? j.data : null;
  } catch {
    return null;
  }
});

const C = { ink: '#1A1A17', t2: '#5B5A53', t3: '#77766E', line: '#E5E4DE', surface: '#F6F6F3', yellow: '#FFC700', soft: '#FFF3C4', done: '#6A3FC6', doneBg: '#EFE8FC' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dayMonth = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}` : ''; };
const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const WORDS = {
  goesLive: (d) => `This post goes live on ${dayMonth(d)}`,
  goesLiveSub: 'Come back then to shop it. Meanwhile, see what else is in the store.',
  gone: 'This post is no longer available',
  goneSub: 'It has left the shop. See what else is in the store.',
  unknown: "We couldn't find this post",
  unknownSub: 'Check the code and try again.',
  storeUnknown: "We couldn't find this store",
  collectionHidden: 'This collection is empty right now',
  collectionUnknown: "We couldn't find this collection",
  visitStore: (name) => `See ${name ? `${name.split(' ')[0]}'s` : 'the'} store`,
  shopInApp: 'Shopping on INFLX happens in the app.',
  getApp: 'Get the INFLX app',
  livePosts: (n) => `${n} live ${n === 1 ? 'post' : 'posts'}`,
  collections: 'Collections',
  nothingLive: 'Nothing live right now.',
  by: (name, brand) => [name, brand].filter(Boolean).join(' · '),
};

export function Frame({ children }) {
  return (
    <main style={{ minHeight: '100vh', background: C.surface, color: C.ink, fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 40px' }}>
        <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', marginBottom: 16 }}>INFLX</div>
        {children}
        <div style={{ marginTop: 24, fontSize: 13, color: C.t2 }}>{WORDS.shopInApp}</div>
        {APP_URL ? (
          <a href={APP_URL} style={{ display: 'block', marginTop: 10, textAlign: 'center', background: C.yellow, color: C.ink, fontWeight: 700, borderRadius: 12, padding: '12px 14px', textDecoration: 'none' }}>{WORDS.getApp}</a>
        ) : null}
      </div>
    </main>
  );
}

const card = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, padding: 14, marginBottom: 12 };

export function Notice({ title, sub, store, tone }) {
  return (
    <div style={{ ...card, background: tone === 'soon' ? C.doneBg : '#fff' }}>
      <div style={{ fontWeight: 800, fontSize: 18, color: tone === 'soon' ? C.done : C.ink }}>{title}</div>
      {sub ? <div style={{ fontSize: 14, color: C.t2, marginTop: 6 }}>{sub}</div> : null}
      {store && store.url ? <a href={store.url} style={{ display: 'inline-block', marginTop: 12, fontWeight: 700, color: C.ink }}>{WORDS.visitStore(store.name)} →</a> : null}
    </div>
  );
}

export function StoreLink({ store }) {
  if (!store || !store.url) return null;
  return <a href={store.url} style={{ display: 'inline-block', fontWeight: 700, color: C.ink }}>{WORDS.visitStore(store.name)} →</a>;
}

export function PostCard({ post, creator, href }) {
  return (
    <div style={card}>
      {post.cover && post.cover.kind !== 'video'
        ? <img src={post.cover.url} alt="" style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', borderRadius: 10, background: C.surface }} />
        : null}
      <div style={{ fontWeight: 800, fontSize: 17, marginTop: post.cover ? 10 : 0 }}>{href ? <a href={href} style={{ color: C.ink, textDecoration: 'none' }}>{post.title}</a> : post.title}</div>
      <div style={{ fontSize: 13, color: C.t2, marginTop: 2 }}>{WORDS.by(creator && creator.name, post.brand_name)}</div>
      {post.offer ? <div style={{ display: 'inline-block', marginTop: 8, fontSize: 12, fontWeight: 700, background: C.soft, borderRadius: 999, padding: '4px 10px' }}>{post.offer}</div> : null}
      {post.products && post.products.length ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0' }}>
          {post.products.map((p, i) => (
            <li key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '6px 0', borderTop: `1px solid ${C.line}` }}>
              <span>{p.name}</span><span style={{ color: C.t2 }}>{rupees(p.price)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {post.code ? <div style={{ marginTop: 8, fontSize: 12, color: C.t3, fontFamily: 'ui-monospace, Menlo, monospace' }}>Code {post.code}</div> : null}
    </div>
  );
}

export function Store({ data }) {
  const s = data.store || {};
  return (
    <>
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>{s.name}</div>
        <div style={{ fontSize: 13, color: C.t2 }}>@{s.handle} · {WORDS.livePosts((data.posts || []).length)}</div>
      </div>
      {(data.posts || []).length ? data.posts.map((p) => <PostCard key={p.code} post={p} href={p.url} />) : <div style={{ fontSize: 14, color: C.t2 }}>{WORDS.nothingLive}</div>}
      {(data.collections || []).length ? (
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{WORDS.collections}</div>
          {data.collections.map((c) => (
            <a key={c.url || c.name} href={c.url || '#'} style={{ display: 'block', padding: '6px 0', color: C.ink }}>{c.name}</a>
          ))}
        </div>
      ) : null}
    </>
  );
}

export function Collection({ data }) {
  return (
    <>
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>{data.name}</div>
        <div style={{ fontSize: 13, color: C.t2 }}>{data.store ? data.store.name : ''}</div>
      </div>
      {(data.items || []).map((it, i) => (
        <div key={i} style={{ ...card, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700 }}>{it.title}</span>
          <span style={{ color: C.t2, fontSize: 13 }}>{it.kind === 'product' && it.price != null ? rupees(it.price) : it.brand_name}</span>
        </div>
      ))}
      {data.store && data.store.url ? <a href={data.store.url} style={{ fontWeight: 700, color: C.ink }}>{WORDS.visitStore(data.store.name)} →</a> : null}
    </>
  );
}
