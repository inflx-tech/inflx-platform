'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, brandApi } from '../lib/api';

const INDUSTRY_GROUPS = [
  { icon: '🍽️', label: 'Food & Dining', count: 4, color: 'from-red-500 to-orange-500' },
  { icon: '🛍️', label: 'Shopping & Retail', count: 9, color: 'from-amber-500 to-yellow-500' },
  { icon: '✨', label: 'Beauty & Grooming', count: 3, color: 'from-pink-500 to-rose-400' },
  { icon: '💪', label: 'Health & Fitness', count: 5, color: 'from-blue-500 to-cyan-400' },
  { icon: '✈️', label: 'Travel & Rentals', count: 4, color: 'from-teal-500 to-emerald-400' },
  { icon: '🏠', label: 'Home Services', count: 5, color: 'from-green-500 to-lime-400' },
  { icon: '🎉', label: 'Events & Professional', count: 5, color: 'from-purple-500 to-violet-400' },
];

const BRAND_CATEGORIES = [
  { group: 'Food & Dining', categories: [
    { value: 'restaurant', label: 'Restaurant & Cafe' }, { value: 'bakery', label: 'Bakery' },
    { value: 'packaged_food', label: 'Packaged Food' }, { value: 'grocery', label: 'Grocery & Supermarket' },
  ]},
  { group: 'Shopping & Retail', categories: [
    { value: 'fashion_walkin', label: 'Fashion & Apparel' }, { value: 'electronics', label: 'Electronics & Gadgets' },
    { value: 'jewellery', label: 'Jewellery & Watches' }, { value: 'footwear', label: 'Footwear' },
    { value: 'furniture', label: 'Home Decor & Furniture' }, { value: 'optical', label: 'Optical / Eyewear' },
    { value: 'pet_shop', label: 'Pet Shops' }, { value: 'flowers_gifting', label: 'Flowers & Gifting' },
    { value: 'hardware', label: 'Hardware & Building' },
  ]},
  { group: 'Beauty & Grooming', categories: [
    { value: 'salon', label: 'Salon & Beauty' }, { value: 'home_beauty', label: 'Home Beauty' },
    { value: 'pet_grooming', label: 'Pet Grooming' },
  ]},
  { group: 'Health & Fitness', categories: [
    { value: 'gym_fitness', label: 'Gym & Fitness' }, { value: 'clinic_doctor', label: 'Clinic & Doctor' },
    { value: 'dental_clinic', label: 'Dental Clinic' }, { value: 'diagnostic_lab', label: 'Diagnostic Lab' },
    { value: 'coaching_center', label: 'Coaching & Tutoring' },
  ]},
  { group: 'Travel & Rentals', categories: [
    { value: 'car_rental', label: 'Car Rental' }, { value: 'bike_rental', label: 'Bike Rental' },
    { value: 'travel_packages', label: 'Travel Packages' }, { value: 'hotel_homestay', label: 'Hotel & Homestay' },
  ]},
  { group: 'Home Services', categories: [
    { value: 'home_services', label: 'Home Services' }, { value: 'pest_control', label: 'Pest Control' },
    { value: 'laundry', label: 'Laundry & Dry Cleaning' }, { value: 'interior_design', label: 'Interior Design' },
    { value: 'coworking_space', label: 'Co-working Space' },
  ]},
  { group: 'Events & Professional', categories: [
    { value: 'function_hall', label: 'Event Venue' }, { value: 'wedding_planner', label: 'Wedding Planner' },
    { value: 'photography', label: 'Photography Studio' }, { value: 'florist', label: 'Florist' },
    { value: 'legal_ca', label: 'Legal / CA' },
  ]},
];

export default function LandingPage() {
  const router = useRouter();
  const [showAuth, setShowAuth] = useState(false);
  const [authRole, setAuthRole] = useState('brand'); // 'brand' | 'influencer'
  const [authStep, setAuthStep] = useState('phone'); // 'phone' | 'otp' | 'register'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [category, setCategory] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // No auto-redirect — landing page always stays visible
  useEffect(() => {
  }, []);

  const fmt = phone.startsWith('+91') ? phone : `+91${phone}`;

  async function handleSendOtp() {
    if (phone.replace(/\D/g, '').length < 10) return;
    setError(''); setLoading(true);
    const res = await authApi.sendOtp(fmt);
    setLoading(false);
    if (res.success) setAuthStep('otp');
    else setError(res.error?.message || 'Failed to send OTP');
  }

  async function handleVerifyOtp() {
    if (otp.length < 6) return;
    setError(''); setLoading(true);
    const role = authRole === 'influencer' ? 'influencer' : 'brand';
    const res = await authApi.verifyOtp(fmt, otp, 'User');
    setLoading(false);
    if (!res.success) { setError(res.error?.message || 'Invalid OTP'); return; }
    const { access_token, user } = res.data;
    localStorage.setItem('inflx_token', access_token);
    localStorage.setItem('inflx_user', JSON.stringify(user));
    document.cookie = `inflx_token=${access_token}; path=/; max-age=2592000; SameSite=Strict`;

    if (authRole === 'brand') {
      const brandRes = await brandApi.getMe();
      if (brandRes.success) { router.push('/dashboard'); return; }
      setAuthStep('register');
    } else {
      // Influencer — check if registered
      const infRes = await brandApi.get('/influencers/me');
      if (infRes.success) {
        alert('Welcome back! Please use the INFLX mobile app for your influencer dashboard.');
        return;
      }
      setAuthStep('register');
    }
  }

  async function handleRegister() {
    setError(''); setLoading(true);
    if (authRole === 'brand') {
      if (!name.trim() || !businessName.trim() || !category) { setError('All fields are required'); setLoading(false); return; }
      const res = await brandApi.register({ business_name: businessName.trim(), category });
      setLoading(false);
      if (!res.success) { setError(res.error?.message || 'Registration failed'); return; }
      localStorage.setItem('inflx_brand', JSON.stringify(res.data?.brand || res.data));
      router.push('/dashboard');
    } else {
      if (!name.trim() || !instagramHandle.trim()) { setError('All fields are required'); setLoading(false); return; }
      const res = await brandApi.post('/influencers/register', { instagram_handle: instagramHandle.trim().replace('@', '') });
      setLoading(false);
      if (!res.success) { setError(res.error?.message || 'Registration failed'); return; }
      alert('Welcome! Download the INFLX app to manage your influencer dashboard.');
    }
  }

  function scrollToAuth() {
    setShowAuth(true);
    setTimeout(() => document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
  }

  return (
    <div className="min-h-screen bg-[#070b16] text-white overflow-x-hidden">

      {/* ═══════════════════ NAVBAR ═══════════════════ */}
      <nav className="fixed top-0 w-full z-50 bg-[#070b16]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="font-display text-xl font-extrabold">
            <img src="/inflx-logo-dark.png" alt="INFLX" style={{height: '32px'}} />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setShowAuth(true); setAuthRole('brand'); scrollToAuth(); }}
              className="px-5 py-2 text-sm font-semibold text-white/70 hover:text-white transition-colors">Sign In</button>
            <button onClick={() => { setShowAuth(true); scrollToAuth(); }}
              className="px-5 py-2 bg-gradient-to-r from-[#F47920] to-[#FFB800] text-[#070b16] text-sm font-bold rounded-full hover:shadow-lg hover:shadow-orange-500/25 transition-all">Get Started</button>
          </div>
        </div>
      </nav>

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section className="pt-32 pb-20 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#F47920]/5 via-transparent to-transparent" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs font-medium text-white/60 mb-6">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            Powering local commerce across India
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Connect Local Brands<br />with <span className="bg-gradient-to-r from-[#F47920] to-[#FFB800] bg-clip-text text-transparent">Influencers</span>
          </h1>
          <p className="text-lg text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            The platform where local businesses create campaigns, influencers promote deals to their followers, and customers discover, book, and pay — all in one ecosystem.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button onClick={scrollToAuth}
              className="px-8 py-3.5 bg-gradient-to-r from-[#F47920] to-[#FFB800] text-[#070b16] font-bold rounded-full text-sm hover:shadow-xl hover:shadow-orange-500/20 transition-all">
              Register Your Business →
            </button>
            <button onClick={scrollToAuth}
              className="px-8 py-3.5 border border-white/15 text-white/80 font-semibold rounded-full text-sm hover:bg-white/5 transition-all">
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
      <section className="py-20 px-6 bg-[#0e1525]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>How It Works</h2>
          <p className="text-white/40 text-center mb-12">Three simple steps to grow your business through influencer marketing</p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { num: '01', icon: '🏪', title: 'Brand Lists Products', desc: 'Register your business, list your products or services. We support 35 business types from restaurants to car rentals.' },
              { num: '02', icon: '📣', title: 'Influencer Promotes', desc: 'Create campaigns, assign influencers. They add personal notes and publish deals to their store for followers to discover.' },
              { num: '03', icon: '💰', title: 'Followers Buy & Pay', desc: 'Followers browse deals, pre-book or pay at store via UPI. Commissions auto-tracked, settlements automated.' },
            ].map((step, i) => (
              <div key={i} className="relative bg-[#151d30] rounded-2xl p-8 border border-white/5 hover:border-[#F47920]/20 transition-all group">
                <div className="text-[#F47920]/20 text-6xl font-black absolute top-4 right-6" style={{ fontFamily: 'Outfit' }}>{step.num}</div>
                <div className="text-4xl mb-4">{step.icon}</div>
                <h3 className="text-lg font-bold mb-2 group-hover:text-[#FFB800] transition-colors">{step.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ FOR BRANDS ═══════════════════ */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-[#F47920]/10 border border-[#F47920]/20 rounded-full px-4 py-1.5 text-xs font-semibold text-[#F47920] mb-4">For Brands</div>
            <h2 className="text-3xl font-extrabold" style={{ fontFamily: 'Outfit, sans-serif' }}>Everything You Need to Grow</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: '📋', title: 'Smart Listings', desc: 'List products with our config-driven wizard. Excel bulk upload supported.' },
              { icon: '📣', title: 'Campaign Manager', desc: 'Create campaigns, set discounts, assign influencers with full tracking.' },
              { icon: '📊', title: 'Real-time Analytics', desc: 'Track reach, engagement, conversions, and ROI per influencer.' },
              { icon: '💳', title: 'Automated Payments', desc: 'Followers pay via UPI. Commissions auto-split. Settlements automated.' },
              { icon: '🔒', title: 'Escrow Protection', desc: '3-tranche escrow ensures influencers deliver before you pay.' },
              { icon: '📦', title: '35 Business Types', desc: 'From restaurants to car rentals — every local business supported.' },
              { icon: '🔗', title: 'Tracking URLs', desc: 'Every transaction attributed to the exact campaign and influencer.' },
              { icon: '📱', title: 'Follower App', desc: 'Your deals reach thousands of local followers through influencer stores.' },
            ].map((f, i) => (
              <div key={i} className="bg-[#151d30] rounded-xl p-5 border border-white/5 hover:border-[#F47920]/15 transition-all">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h4 className="font-bold text-sm mb-1">{f.title}</h4>
                <p className="text-xs text-white/35 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ FOR INFLUENCERS ═══════════════════ */}
      <section className="py-20 px-6 bg-[#0e1525]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 rounded-full px-4 py-1.5 text-xs font-semibold text-[#8b5cf6] mb-4">For Influencers</div>
            <h2 className="text-3xl font-extrabold" style={{ fontFamily: 'Outfit, sans-serif' }}>Turn Your Influence Into Income</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: '🎯', title: 'Get Campaign Offers', desc: 'Brands invite you to promote their products. Accept, negotiate, or decline.' },
              { icon: '🏪', title: 'Your Personal Store', desc: 'Publish deals to your store. Followers see your recommendations.' },
              { icon: '💰', title: 'Earn Commissions', desc: 'Every follower purchase through your deal earns you commission.' },
              { icon: '🏦', title: 'Easy Withdrawals', desc: 'Withdraw to UPI or bank. TDS auto-calculated. Min ₹100.' },
            ].map((f, i) => (
              <div key={i} className="bg-[#151d30] rounded-xl p-5 border border-white/5 hover:border-[#8b5cf6]/15 transition-all">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h4 className="font-bold text-sm mb-1">{f.title}</h4>
                <p className="text-xs text-white/35 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ CATEGORIES ═══════════════════ */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>35 Business Types Supported</h2>
          <p className="text-white/40 mb-10">From street food to luxury hotels — every local business can list and grow</p>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {INDUSTRY_GROUPS.map((g, i) => (
              <div key={i} className="bg-[#151d30] rounded-xl p-4 border border-white/5 hover:border-white/15 transition-all text-center group cursor-default">
                <div className="text-3xl mb-2">{g.icon}</div>
                <div className="text-xs font-semibold text-white/70 group-hover:text-white transition-colors">{g.label}</div>
                <div className="text-[10px] text-white/30 mt-1">{g.count} types</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ STATS ═══════════════════ */}
      <section className="py-16 px-6 bg-[#0e1525]">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { val: '35+', label: 'Business Types' },
            { val: '20+', label: 'Influencers' },
            { val: '7', label: 'Categories' },
            { val: '₹0', label: 'Platform Fee to Start' },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-3xl font-extrabold bg-gradient-to-r from-[#F47920] to-[#FFB800] bg-clip-text text-transparent" style={{ fontFamily: 'Outfit' }}>{s.val}</div>
              <div className="text-xs text-white/35 mt-1 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════ AUTH SECTION ═══════════════════ */}
      <section id="auth-section" className="py-20 px-6">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">

          {/* ── Brand Sign In / Sign Up ── */}
          <div>
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-[#F47920]/10 border border-[#F47920]/20 rounded-full px-4 py-1.5 text-xs font-semibold text-[#F47920] mb-3">For Brands</div>
              <h2 className="text-2xl font-extrabold" style={{ fontFamily: 'Outfit, sans-serif' }}>Brand Dashboard</h2>
              <p className="text-white/40 text-xs mt-1">Sign in or create your business account</p>
            </div>

            <div className="bg-[#151d30] rounded-2xl p-7 border border-white/10">
              {/* Phone step */}
              {authStep === 'phone' && (
                <div>
                  <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Phone Number</label>
                  <div className="flex mb-4">
                    <div className="bg-[#0e1525] border border-white/10 border-r-0 rounded-l-xl px-4 flex items-center text-sm text-white/40 font-medium">+91</div>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Enter 10-digit number"
                      className="flex-1 bg-[#0e1525] border border-white/10 rounded-r-xl px-4 py-3.5 text-white text-sm outline-none focus:border-[#F47920]/50 transition-colors" />
                  </div>
                  {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
                  <button onClick={handleSendOtp} disabled={loading || phone.replace(/\D/g, '').length < 10}
                    className="w-full py-3.5 bg-gradient-to-r from-[#F47920] to-[#FFB800] text-[#070b16] font-bold rounded-xl text-sm disabled:opacity-40 hover:shadow-lg hover:shadow-orange-500/20 transition-all">
                    {loading ? 'Sending...' : 'Send OTP →'}
                  </button>
                  <p className="text-[10px] text-white/20 text-center mt-3">New user? You'll be registered automatically after OTP</p>
                </div>
              )}

              {/* OTP step */}
              {authStep === 'otp' && (
                <div>
                  <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Enter OTP</label>
                  <p className="text-xs text-white/30 mb-3">Sent to +91 {phone}</p>
                  <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000" maxLength={6} autoFocus
                    className="w-full bg-[#0e1525] border border-white/10 rounded-xl px-4 py-4 text-white text-2xl text-center tracking-[1em] font-bold outline-none focus:border-[#F47920]/50 mb-4" />
                  {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
                  <button onClick={handleVerifyOtp} disabled={loading || otp.length < 6}
                    className="w-full py-3.5 bg-gradient-to-r from-[#F47920] to-[#FFB800] text-[#070b16] font-bold rounded-xl text-sm disabled:opacity-40 transition-all">
                    {loading ? 'Verifying...' : 'Verify →'}
                  </button>
                  <button onClick={() => { setAuthStep('phone'); setOtp(''); setError(''); }} className="w-full mt-2 py-2 text-xs text-white/30 hover:text-white/50">← Change number</button>
                </div>
              )}

              {/* Register step (brand only) */}
              {authStep === 'register' && (
                <div>
                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">Your Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" autoFocus
                      className="w-full bg-[#0e1525] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#F47920]/50" />
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">Business Name</label>
                    <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Spice Garden Restaurant"
                      className="w-full bg-[#0e1525] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#F47920]/50" />
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">Industry</label>
                    <select value={industry} onChange={e => { setIndustry(e.target.value); setCategory(''); }}
                      className="w-full bg-[#0e1525] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#F47920]/50">
                      <option value="" className="bg-[#0e1525]">Select your industry</option>
                      {BRAND_CATEGORIES.map(g => <option key={g.group} value={g.group} className="bg-[#0e1525]">{g.group}</option>)}
                    </select>
                  </div>
                  {industry && (
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">Business Type</label>
                      <select value={category} onChange={e => setCategory(e.target.value)}
                        className="w-full bg-[#0e1525] border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#F47920]/50">
                        <option value="" className="bg-[#0e1525]">Select your business type</option>
                        {BRAND_CATEGORIES.find(g => g.group === industry)?.categories.map(c => (
                          <option key={c.value} value={c.value} className="bg-[#0e1525]">{c.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
                  <button onClick={handleRegister} disabled={loading}
                    className="w-full py-3.5 bg-gradient-to-r from-[#F47920] to-[#FFB800] text-[#070b16] font-bold rounded-xl text-sm disabled:opacity-40 transition-all">
                    {loading ? 'Registering...' : 'Complete Registration →'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Influencer — Download App CTA ── */}
          <div>
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 rounded-full px-4 py-1.5 text-xs font-semibold text-[#8b5cf6] mb-3">For Influencers</div>
              <h2 className="text-2xl font-extrabold" style={{ fontFamily: 'Outfit, sans-serif' }}>Influencer App</h2>
              <p className="text-white/40 text-xs mt-1">Download the INFLX app to get started</p>
            </div>

            <div className="bg-[#151d30] rounded-2xl p-7 border border-white/10 text-center">
              <div className="text-6xl mb-4">📱</div>
              <h3 className="text-lg font-bold mb-2">Get the INFLX App</h3>
              <p className="text-sm text-white/40 mb-6 leading-relaxed">
                Manage your campaigns, publish deals to your store, track commissions, and withdraw earnings — all from the mobile app.
              </p>
              <div className="space-y-3">
                <a href="#" className="flex items-center justify-center gap-3 w-full py-3.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                  <span className="text-2xl">🤖</span>
                  <div className="text-left">
                    <div className="text-[9px] text-white/40 uppercase">Download on</div>
                    <div className="text-sm font-bold text-white">Google Play</div>
                  </div>
                </a>
                <a href="#" className="flex items-center justify-center gap-3 w-full py-3.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                  <span className="text-2xl">🍎</span>
                  <div className="text-left">
                    <div className="text-[9px] text-white/40 uppercase">Download on</div>
                    <div className="text-sm font-bold text-white">App Store</div>
                  </div>
                </a>
              </div>
              <p className="text-[10px] text-white/20 mt-4">Also available for followers to discover deals</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="py-12 px-6 border-t border-white/5 bg-[#070b16]">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="font-display text-lg font-extrabold mb-1">
              <img src="/inflx-logo-dark.png" alt="INFLX" style={{height: '32px'}} />
            </div>
            <p className="text-xs text-white/25">Connecting local brands with influencers across India</p>
          </div>
          <div className="flex items-center gap-6 text-xs text-white/30">
            <a href="#" className="hover:text-white/60 transition-colors">About</a>
            <a href="#" className="hover:text-white/60 transition-colors">Privacy</a>
            <a href="#" className="hover:text-white/60 transition-colors">Terms</a>
            <a href="#" className="hover:text-white/60 transition-colors">Contact</a>
          </div>
          <p className="text-[10px] text-white/15">© 2026 INFLX. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
