'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Logo from '../../shared/components/Logo';
import SiteFooter from '../components/SiteFooter';

// The landing page runs on the same white + yellow system as /login and
// /dashboard (#FFFFFF ground, #0A0A0A ink, #FFC107 accent). It used to be the
// last dark surface in brand-web, so a visitor who signed up crossed a hard
// visual seam into what looked like a different company's product.

const INDUSTRY_GROUPS = [
  { icon: '🍽️', label: 'Food & Dining', count: 4 },
  { icon: '🛍️', label: 'Shopping', count: 9 },
  { icon: '✨', label: 'Beauty', count: 3 },
  { icon: '💪', label: 'Health & Fitness', count: 5 },
  { icon: '✈️', label: 'Travel', count: 4 },
  { icon: '🏠', label: 'Home Services', count: 5 },
  { icon: '🎉', label: 'Events', count: 5 },
];

const STEPS = [
  { num: '01', icon: '🏪', title: 'Brand lists and funds', desc: 'Register your business, list what you sell, create a campaign and fund it. 35 business types are supported, from street food to car rentals.' },
  { num: '02', icon: '📣', title: 'Creator promotes', desc: 'Creators accept, negotiate or decline the offer, then publish the deal to their own store with their own recommendation attached.' },
  { num: '03', icon: '💰', title: 'Shopper buys, everyone settles', desc: 'Followers browse, book or pay at the store. Commission is attributed to the exact creator and released once the return window closes.' },
];

const BRAND_FEATURES = [
  { icon: '📋', title: 'Smart listings', desc: 'A guided wizard per business type. Excel bulk upload for large catalogues.' },
  { icon: '📣', title: 'Campaign manager', desc: 'Set offers, invite creators, review content before it goes live.' },
  { icon: '📊', title: 'Real analytics', desc: 'Reach, engagement, conversions and ROI — per creator, per offer.' },
  { icon: '💳', title: 'Automated payouts', desc: 'Commission split and settled automatically. No spreadsheets.' },
  { icon: '🔒', title: 'Escrow protection', desc: 'Funds release in three tranches as the creator actually delivers.' },
  { icon: '📦', title: '35 business types', desc: 'Restaurants, fashion, salons, gyms, rentals, home services and more.' },
  { icon: '🔗', title: 'Tracked links', desc: 'Every order attributed to the campaign, offer and creator behind it.' },
  { icon: '📱', title: 'Reach on mobile', desc: 'Your deals surface inside creator stores in the shopper app.' },
];

const CREATOR_FEATURES = [
  { icon: '🎯', title: 'Real offers', desc: 'Brands invite you. Accept, negotiate the rate, or decline — your call.' },
  { icon: '🏪', title: 'Your own store', desc: 'Publish deals to a storefront your followers can actually shop.' },
  { icon: '💰', title: 'Commission per sale', desc: 'Earn on every purchase made through your deal, tracked automatically.' },
  { icon: '🏦', title: 'Clean withdrawals', desc: 'Withdraw to UPI or bank. Tax handled at source. Minimum ₹100.' },
];

const SHOPPER_FEATURES = [
  { icon: '🔍', title: 'Discover locally', desc: 'Deals from businesses in your city, picked by creators you already follow.' },
  { icon: '🎟️', title: 'Honest offers', desc: 'Flat, percentage, bundle, BOGO and pre-book — priced in full before you commit.' },
  { icon: '🛵', title: 'Order or book', desc: 'Buy for delivery, book a slot, or pay at the store counter.' },
  { icon: '↩️', title: 'Protected returns', desc: 'A stated return window on eligible orders, with refunds to the original method.' },
];

// The responsibility notices. These are on the landing page rather than buried
// in the terms because the whole point is that a visitor reads them before
// they transact, not after something has gone wrong.
const NOTICES = [
  { k: '👤', title: 'Creator responsibility', body: 'Creators are solely responsible for the content they publish, including promotional claims, advertising disclosures, and compliance with applicable advertising regulations.' },
  { k: '🏬', title: 'Brand responsibility', body: 'Brands are solely responsible for the products, pricing, inventory, warranties, fulfilment and legal compliance associated with their offerings.' },
  { k: '🔐', title: 'Payments', body: 'Payments are processed through trusted third-party payment partners. INFLX does not store complete payment card information.' },
  { k: '🌐', title: 'Availability', body: 'Certain platform features may vary by region and may change without prior notice as the platform evolves.' },
  { k: '✦', title: 'AI assistance', body: 'Some features use artificial intelligence to assist with recommendations, analytics, content organisation and workflow automation. AI-generated insights should be reviewed independently before business decisions are made.' },
  { k: '⚖️', title: 'Marketplace disclaimer', body: 'INFLX connects brands, creators and consumers. Unless explicitly stated, INFLX does not manufacture, own or guarantee products or services offered by third parties.' },
  // Told to the shopper, not just written into the creator's contract. Across
  // every comparable Indian platform surveyed, commission is disclosed only as
  // a platform-to-creator fee and never as a material-connection notice to the
  // person actually spending the money. Saying it plainly costs nothing.
  { k: '🏷️', title: 'Creators earn commission', body: 'When you buy through a creator’s store, that creator usually earns a commission on the sale. It does not change what you pay. Paid and promoted placements are labelled wherever they appear.' },
];

function Eyebrow({ children, onPale }) {
  return (
    <span
      className="mb-3.5 inline-block rounded-full px-3.5 py-1.5 font-display text-[11.5px] font-extrabold uppercase tracking-[0.1em]"
      style={{ background: onPale ? '#FFFFFF' : '#FFF7CC', color: '#8A6A00' }}
    >
      {children}
    </span>
  );
}

function MiniCard({ f }) {
  return (
    <div className="rounded-2xl border p-5 transition-colors hover:border-[#FFC107]" style={{ borderColor: '#E4E4E7', background: '#fff' }}>
      <div className="mb-2.5 text-[21px]">{f.icon}</div>
      <h4 className="mb-1.5 font-display text-[14px] font-bold" style={{ color: '#0A0A0A' }}>{f.title}</h4>
      <p className="m-0 text-[12.5px] leading-[1.6]" style={{ color: '#71717A' }}>{f.desc}</p>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();

  // Returning visitors on this browser shouldn't be asked to sign in again.
  // Resolved after mount (localStorage is client-only) so the server-rendered
  // markup stays identical for everyone and hydration doesn't mismatch —
  // signed-out is the honest default until we know otherwise.
  const [session, setSession] = useState(null);
  useEffect(() => {
    try {
      const token = localStorage.getItem('inflx_token');
      const user  = JSON.parse(localStorage.getItem('inflx_user') || 'null');
      if (!token || !user) return;
      // Only roles that actually have a web surface. Influencers and followers
      // live in the mobile apps, so a "go to dashboard" link would dead-end.
      if (user.role === 'admin')      setSession({ href: '/admin',     label: 'Go to Admin' });
      else if (user.role === 'brand') setSession({ href: '/dashboard', label: 'Go to Dashboard' });
    } catch { /* unreadable storage — stay signed-out */ }
  }, []);

  const goHome = () => { if (session) router.push(session.href); };

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: '#FFFFFF', color: '#0A0A0A' }}>

      {/* ═══════════════════ NAVBAR ═══════════════════ */}
      <nav
        className="sticky top-0 z-50"
        style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #E4E4E7' }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Logo tone="dark" size="sm" />

          <div className="hidden items-center gap-7 text-[13.5px] font-semibold md:flex" style={{ color: '#52525B' }}>
            <a href="#brands" className="no-underline hover:text-[#0A0A0A]">For Brands</a>
            <a href="#creators" className="no-underline hover:text-[#0A0A0A]">For Creators</a>
            <a href="#shoppers" className="no-underline hover:text-[#0A0A0A]">For Shoppers</a>
            <a href="#trust" className="no-underline hover:text-[#0A0A0A]">Trust</a>
          </div>

          <div className="flex items-center gap-1.5">
            {session ? (
              <button onClick={goHome}
                className="rounded-full px-5 py-2.5 text-[13.5px] font-bold transition-colors hover:bg-[#E0A800]"
                style={{ background: '#FFC107', color: '#0A0A0A' }}>{session.label} →</button>
            ) : (
              <>
                <button onClick={() => router.push('/login')}
                  className="rounded-full px-4 py-2.5 text-[13.5px] font-semibold transition-colors hover:text-[#0A0A0A]"
                  style={{ color: '#52525B' }}>Sign In</button>
                <button onClick={() => router.push('/login')}
                  className="rounded-full px-5 py-2.5 text-[13.5px] font-bold transition-colors hover:bg-[#E0A800]"
                  style={{ background: '#FFC107', color: '#0A0A0A' }}>Get Started</button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section className="relative overflow-hidden px-6 pb-20 pt-24">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(680px 320px at 50% -6%, rgba(255,193,7,0.22), transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <span
            className="mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-bold"
            style={{ background: '#FFFBEB', border: '1px solid #F5E3A8', color: '#8A6A00' }}
          >
            <span className="inline-block h-[7px] w-[7px] animate-pulse rounded-full" style={{ background: '#16A34A' }} />
            Powering local commerce across India
          </span>

          <h1 className="mb-5 font-display text-[38px] font-extrabold leading-[1.06] tracking-[-0.03em] md:text-[56px]">
            Where local brands and<br />
            <span className="relative inline-block">
              <span className="relative z-10">creators</span>
              <span className="absolute bottom-[0.08em] left-[-2px] right-[-2px] h-[0.34em] rounded-sm" style={{ background: '#FFC107' }} />
            </span>{' '}
            grow together
          </h1>

          <p className="mx-auto mb-8 max-w-[620px] text-[16px] leading-[1.62] md:text-[17.5px]" style={{ color: '#52525B' }}>
            Brands run campaigns. Creators promote deals to the people who actually trust
            them. Shoppers discover, book and pay — with every rupee of commission tracked
            automatically.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {session ? (
              <button onClick={goHome}
                className="rounded-full px-8 py-3.5 text-[14.5px] font-bold transition-colors hover:bg-[#E0A800]"
                style={{ background: '#FFC107', color: '#0A0A0A' }}>{session.label} →</button>
            ) : (
              <>
                <button onClick={() => router.push('/login')}
                  className="rounded-full px-8 py-3.5 text-[14.5px] font-bold transition-colors hover:bg-[#E0A800]"
                  style={{ background: '#FFC107', color: '#0A0A0A' }}>Register Your Business →</button>
                <button onClick={() => router.push('/login')}
                  className="rounded-full px-7 py-3.5 text-[14px] font-bold transition-colors hover:bg-[#F4F4F5]"
                  style={{ background: '#fff', color: '#0A0A0A', border: '1px solid #D4D4D8' }}>Join as a Creator</button>
              </>
            )}
          </div>

          <p className="mt-6 text-[12.5px]" style={{ color: '#71717A' }}>
            A product of Omnara India Private Limited · Payments handled by our payment partner · Made in India
          </p>
        </div>
      </section>

      {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
      <section className="px-6 py-[76px]" style={{ background: '#FAFAFA', borderTop: '1px solid #E4E4E7', borderBottom: '1px solid #E4E4E7' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-11 text-center">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="font-display text-[28px] font-extrabold tracking-[-0.02em] md:text-[34px]">Three sides, one loop</h2>
            <p className="mt-2.5 text-[15.5px] leading-[1.6]" style={{ color: '#52525B' }}>
              Every transaction carries the campaign, offer and creator it came from — so attribution is never a guess.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.num} className="relative rounded-2xl border p-6 transition-all hover:border-[#FFC107]" style={{ borderColor: '#E4E4E7', background: '#fff' }}>
                <div className="absolute right-5 top-4 font-display text-[44px] font-extrabold leading-none" style={{ color: '#FFF7CC' }}>{s.num}</div>
                <div className="mb-3.5 text-[26px]">{s.icon}</div>
                <h3 className="mb-1.5 font-display text-[16.5px] font-bold">{s.title}</h3>
                <p className="m-0 text-[13.5px] leading-[1.62]" style={{ color: '#52525B' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ FOR BRANDS ═══════════════════ */}
      <section id="brands" className="px-6 py-[76px]">
        <div className="mx-auto max-w-5xl">
          <div className="mb-11 text-center">
            <Eyebrow>For brands</Eyebrow>
            <h2 className="font-display text-[28px] font-extrabold tracking-[-0.02em] md:text-[34px]">Everything you need to grow</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BRAND_FEATURES.map((f) => <MiniCard key={f.title} f={f} />)}
          </div>
        </div>
      </section>

      {/* ═══════════════════ FOR CREATORS ═══════════════════ */}
      <section id="creators" className="px-6 py-[76px]" style={{ background: '#FAFAFA', borderTop: '1px solid #E4E4E7', borderBottom: '1px solid #E4E4E7' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-11 text-center">
            <Eyebrow>For creators</Eyebrow>
            <h2 className="font-display text-[28px] font-extrabold tracking-[-0.02em] md:text-[34px]">Turn influence into income</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CREATOR_FEATURES.map((f) => <MiniCard key={f.title} f={f} />)}
          </div>
        </div>
      </section>

      {/* ═══════════════════ FOR SHOPPERS ═══════════════════
          The third side, which the previous landing page never explained even
          though it is where money actually enters the platform. */}
      <section id="shoppers" className="px-6 py-[76px]">
        <div className="mx-auto max-w-5xl">
          <div className="mb-11 text-center">
            <Eyebrow>For shoppers</Eyebrow>
            <h2 className="font-display text-[28px] font-extrabold tracking-[-0.02em] md:text-[34px]">Buy from people you already follow</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SHOPPER_FEATURES.map((f) => <MiniCard key={f.title} f={f} />)}
          </div>
        </div>
      </section>

      {/* ═══════════════════ CATEGORIES ═══════════════════ */}
      <section className="px-6 py-[76px]" style={{ background: '#FAFAFA', borderTop: '1px solid #E4E4E7', borderBottom: '1px solid #E4E4E7' }}>
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-10">
            <h2 className="font-display text-[28px] font-extrabold tracking-[-0.02em] md:text-[34px]">35 business types supported</h2>
            <p className="mt-2.5 text-[15.5px]" style={{ color: '#52525B' }}>From street food to luxury stays — every local business can list and grow.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {INDUSTRY_GROUPS.map((g) => (
              <div key={g.label} className="rounded-2xl border p-4 text-center transition-colors hover:border-[#FFC107]" style={{ borderColor: '#E4E4E7', background: '#fff' }}>
                <div className="text-[26px]">{g.icon}</div>
                <div className="mt-2 text-[12px] font-bold">{g.label}</div>
                <div className="mt-0.5 text-[10.5px]" style={{ color: '#A1A1AA' }}>{g.count} types</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ STATS ═══════════════════ */}
      <section className="px-6 py-14">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 text-center md:grid-cols-4">
          {[
            { v: '35+', l: 'Business types' },
            { v: '3', l: 'Connected apps' },
            { v: '7', l: 'Categories' },
            { v: '₹0', l: 'To get started' },
          ].map((s) => (
            <div key={s.l}>
              <div className="font-display text-[34px] font-extrabold tracking-[-0.02em]" style={{ color: '#E0A800' }}>{s.v}</div>
              <div className="mt-1 text-[12.5px] font-semibold" style={{ color: '#71717A' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════ APPS ═══════════════════ */}
      <section className="px-6 py-[76px]" style={{ background: '#FAFAFA', borderTop: '1px solid #E4E4E7', borderBottom: '1px solid #E4E4E7' }}>
        <div className="mx-auto max-w-3xl">
          <div className="mb-11 text-center">
            <Eyebrow>Get started</Eyebrow>
            <h2 className="font-display text-[28px] font-extrabold tracking-[-0.02em] md:text-[34px]">Pick your side</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-3xl border p-7 text-center" style={{ borderColor: '#E4E4E7', background: '#fff' }}>
              <div className="mb-3 text-[38px]">💼</div>
              <h3 className="mb-1.5 font-display text-[18px] font-extrabold">Brands</h3>
              <p className="mb-5 text-[13px] leading-[1.6]" style={{ color: '#52525B' }}>
                Run your business from the web dashboard — listings, campaigns, wallet, analytics.
              </p>
              <button onClick={session ? goHome : () => router.push('/login')}
                className="w-full rounded-full py-3.5 text-[13.5px] font-bold transition-colors hover:bg-[#E0A800]"
                style={{ background: '#FFC107', color: '#0A0A0A' }}>
                {session ? `${session.label} →` : 'Sign In / Register →'}
              </button>
            </div>

            <div className="rounded-3xl border p-7 text-center" style={{ borderColor: '#E4E4E7', background: '#fff' }}>
              <div className="mb-3 text-[38px]">📱</div>
              <h3 className="mb-1.5 font-display text-[18px] font-extrabold">Creators &amp; shoppers</h3>
              <p className="mb-5 text-[13px] leading-[1.6]" style={{ color: '#52525B' }}>
                Manage campaigns, publish deals and track earnings — or just shop — from the app.
              </p>
              {[
                { icon: '🤖', top: 'Get it on', name: 'Google Play' },
                { icon: '🍎', top: 'Download on', name: 'App Store' },
              ].map((s) => (
                <a key={s.name} href="#"
                  className="mb-2.5 flex w-full items-center justify-center gap-2.5 rounded-xl border py-3 no-underline transition-colors hover:bg-[#F4F4F5]"
                  style={{ borderColor: '#D4D4D8', background: '#fff' }}>
                  <span className="text-[20px]">{s.icon}</span>
                  <span className="text-left">
                    <span className="block text-[9px] font-bold uppercase tracking-[0.06em]" style={{ color: '#A1A1AA' }}>{s.top}</span>
                    <span className="block text-[13.5px] font-extrabold" style={{ color: '#0A0A0A' }}>{s.name}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ TRUST & RESPONSIBILITY ═══════════════════ */}
      <section id="trust" className="px-6 py-[76px]" style={{ background: '#FFFBEB', borderTop: '1px solid #F5E3A8', borderBottom: '1px solid #F5E3A8' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-11 text-center">
            <Eyebrow onPale>Trust &amp; responsibility</Eyebrow>
            <h2 className="font-display text-[28px] font-extrabold tracking-[-0.02em] md:text-[34px]">Who is responsible for what</h2>
            <p className="mt-2.5 text-[15.5px] leading-[1.6]" style={{ color: '#52525B' }}>
              INFLX is a technology platform. Being explicit about this protects everyone using it.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {NOTICES.map((n) => (
              <div key={n.title} className="rounded-2xl border p-5" style={{ borderColor: '#F0E4BC', background: '#fff' }}>
                <h4 className="mb-2 flex items-center gap-2 font-display text-[14.5px] font-bold">
                  <span className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md text-[12px]" style={{ background: '#FFC107' }}>{n.k}</span>
                  {n.title}
                </h4>
                <p className="m-0 text-[12.8px] leading-[1.65]" style={{ color: '#52525B' }}>{n.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-[13px]" style={{ color: '#52525B' }}>
            Read the full terms in our{' '}
            <a href="/legal" className="font-semibold underline" style={{ color: '#0A0A0A' }}>legal documents</a>, or see{' '}
            <a href="/legal/ranking" className="font-semibold underline" style={{ color: '#0A0A0A' }}>how ranking works</a>.
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
