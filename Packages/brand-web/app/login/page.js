'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, authApi, brandApi, setSessionCookie } from '../../lib/api';
import { streetError, STREET_MAX, STORE_COPY } from '../../lib/storeAddress';
import Logo from '../../../shared/components/Logo';

// Device-local draft of the registration step. Cleared on successful
// register, and only ever read when a session token already exists.
const DRAFT_KEY = 'inflx_brand_signup_draft';

// Docs/THE_CUT.md pass 0, founder 2026-09-02: "INFLX is a fashion platform."
//
// This list used to offer 30 business types across 7 industries — restaurants,
// car rental, salons, pest control, wedding planners. A business could sign up as
// any of them, list its products, and have nowhere for a shopper to see them.
//
// There is now exactly one, so the two-dropdown industry -> type picker is gone
// with it: two selects offering one choice each is worse than a plain statement.
// The server is the actual gate (backend/src/services/businessCategory.model.js);
// this constant only decides what the form SAYS, and re-opening a vertical means
// editing the server list, not this file.
//
// The `fashion` schema already carries Footwear, Jewellery, Accessories and Bags
// as sections, so one category covers everything being onboarded today.
const CATEGORY = 'fashion';
const CATEGORY_LABEL = 'Fashion — clothing, footwear, jewellery & accessories';
// Item 2 (rules v1.10 §8A, founder Q5b): after Fashion, a brand picks one or more of the
// eight sub-categories. Required. The server list (ref_brand_categories) is the gate; this
// mirror only decides what the form shows if the list cannot be fetched.
const SUB_CATEGORIES_FALLBACK = [
  { code: 'MEN', label: 'Men' }, { code: 'WOMEN', label: 'Women' }, { code: 'KIDS', label: 'Kids' },
  { code: 'PLUS_SIZE', label: 'Plus Size' }, { code: 'WATCHES', label: 'Watches' },
  { code: 'IMITATION_JEWELLERY', label: 'Imitation Jewellery' }, { code: 'FOOTWEAR', label: 'Footwear' },
  { code: 'BAGS_ACCESSORIES', label: 'Bags & Accessories' },
];

// Docs/NEXT_ROUND_2026-09-19.md item 5: the website takes the same four-part address as
// the phones — street typed, 6-digit pincode, state picked, nearest major city picked from
// that state. States and cities come from GET /reference/states?offered=1 (the six offered
// states and their cities, ids included); nothing here talks to Google any more.
function toId(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export default function LoginPage() {
  const router = useRouter();
  // Steps: phone -> otp -> register (name+business+category on one screen)
  const [step, setStep]               = useState('phone');
  const [phone, setPhone]             = useState('');
  const [otp, setOtp]                 = useState('');
  const [name, setName]               = useState('');
  const [businessName, setBusinessName] = useState('');
  // Docs/THE_CUT.md pass 0 — no longer chosen. Held as a constant so the register
  // payload keeps its shape and the server keeps validating the field.
  const category = CATEGORY;
  // Item 2 — the eight sub-categories (multi-select, at least one).
  const [subCategories, setSubCategories] = useState([]);
  const [subCategoryOptions, setSubCategoryOptions] = useState(SUB_CATEGORIES_FALLBACK);
  useEffect(() => {
    if (step !== 'register') return;
    api.get('/reference/brand-categories').then(r => {
      if (r?.success && Array.isArray(r.data?.items) && r.data.items.length) setSubCategoryOptions(r.data.items);
    }).catch(() => {});
  }, [step]);
  function toggleSubCategory(code) {
    setSubCategories(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  }
  const [addressLine, setAddressLine] = useState('');
  const [pincode, setPincode]         = useState('');
  // Item 5 — state and nearest major city are picked by id from the offered list.
  const [stateId, setStateId]         = useState(null);
  const [cityId, setCityId]           = useState(null);
  const [states, setStates]           = useState([]);   // [{ id, name, cities:[{ id, name }] }]
  useEffect(() => {
    if (step !== 'register') return;
    api.get('/reference/states?offered=1').then(r => {
      if (r?.success && Array.isArray(r.data?.items)) setStates(r.data.items);
    }).catch(() => {});
  }, [step]);
  const selectedState = states.find(s => s.id === stateId) || null;
  const cityOptions = selectedState?.cities || [];
  function pickState(v) {
    const id = toId(v);
    setStateId(id);
    setCityId(null);   // the city belongs to the state; changing one clears the other
  }
  const [loading, setLoading]         = useState(false);
  const [resending, setResending]     = useState(false);
  const [error, setError]             = useState('');
  const [restored, setRestored]       = useState(false);

  // ── Signup draft persistence ──────────────────────────────────────────
  // Every field above used to be plain component state with nothing behind
  // it, so a refresh (or a back-nav, or a tab crash) mid-registration reset
  // the wizard to the phone step AND burned one of the 5 hourly OTPs. A few
  // refreshes locked the user out for an hour with no way back to their
  // half-filled form — which is exactly what happens when someone notices a
  // typo in the address and tries to start over.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // Only meaningful once OTP has succeeded — before that there is no
      // session to resume into and the phone step is the correct start.
      if (!localStorage.getItem('inflx_token')) return;
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (!d) return;
      setPhone(d.phone || '');
      setName(d.name || '');
      setBusinessName(d.businessName || '');
      // A draft saved before the cut can carry an old category (restaurant, salon).
      // Deliberately NOT restored: the server would refuse it, and restoring it would
      // resurrect a choice that no longer exists.
      setAddressLine(d.addressLine || '');
      setPincode(d.pincode || '');
      // Drafts saved before item 5 carry typed `city`/`state` names, a Maps link, coords,
      // a referral code. None of that is restored — unknown keys are simply ignored.
      const sid = toId(d.stateId);
      setStateId(sid);
      setCityId(sid ? toId(d.cityId) : null);
      setStep('register');
      setRestored(true);
    } catch { /* corrupt draft — fall through to a clean phone step */ }
  }, []);

  // Mirror the register-step fields into the draft as they change. Cheap,
  // synchronous, and scoped to this device — no server draft table needed.
  useEffect(() => {
    if (typeof window === 'undefined' || step !== 'register') return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        phone, name, businessName, addressLine, pincode, stateId, cityId,
      }));
    } catch { /* quota or private mode — persistence is best-effort */ }
  }, [step, phone, name, businessName, addressLine, pincode, stateId, cityId]);

  const fmt = phone.startsWith('+91') ? phone : `+91${phone}`;

  // Step 1: Send OTP
  async function handleSendOtp(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await authApi.sendOtp(fmt);
    setLoading(false);
    if (res.success) setStep('otp');
    else setError(res.error?.message || 'Failed to send OTP');
  }

  async function handleResendOtp() {
    setError(''); setOtp(''); setResending(true);
    const res = await authApi.sendOtp(fmt);
    setResending(false);
    if (!res.success) setError(res.error?.message || 'Failed to resend OTP');
  }

  // Step 2: Verify OTP
  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError('');
    if (otp.length < 6) { setError('Enter the 6-digit OTP'); return; }
    setLoading(true);

    const res = await authApi.verifyOtp(fmt, otp, 'Brand User');
    setLoading(false);

    if (!res.success) {
      setError(res.error?.message || 'Invalid OTP');
      return;
    }

    const { access_token, user } = res.data;
    localStorage.setItem('inflx_token', access_token);
    localStorage.setItem('inflx_user', JSON.stringify(user));
    setSessionCookie(access_token);

    if (user.role === 'admin') {
      router.push('/admin');
      return;
    }
    if (user.role === 'influencer' || user.role === 'follower') {
      setError(`This phone is registered as ${user.role}. Please use the ${user.role} mobile app.`);
      localStorage.removeItem('inflx_token');
      localStorage.removeItem('inflx_user');
      document.cookie = 'inflx_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      return;
    }
    if (user.role === 'brand') {
      const brandRes = await brandApi.getMe();
      if (brandRes.success) {
        const brand = brandRes.data?.brand || brandRes.data;
        localStorage.setItem('inflx_brand', JSON.stringify(brand));
        router.push('/dashboard');
        return;
      }
    }

    setStep('register');
  }

  // Step 3: Register brand
  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (!businessName.trim()) { setError('Please enter your business name'); return; }
    if (subCategories.length === 0) { setError('Pick at least one category your brand sells'); return; }
    if (!addressLine.trim()) { setError('Please enter your business address'); return; }
    // features/courier-ready-addresses — a courier has to find the store: a shop or door number.
    if (streetError(addressLine)) { setError(streetError(addressLine)); return; }
    if (!/^[0-9]{6}$/.test(pincode.trim())) { setError('Pincode must be 6 digits'); return; }
    if (!stateId) { setError('Please select your state'); return; }
    if (!cityId) { setError(STORE_COPY.cityRequired); return; }

    setLoading(true);

    const res = await brandApi.register({
      name:          name.trim(),
      business_name: businessName.trim(),
      category,
      sub_categories: subCategories,
      address_line:  addressLine.trim(),
      pincode:       pincode.trim(),
      state_id:      stateId,
      city_id:       cityId,
    });
    setLoading(false);

    if (!res.success) {
      setError(res.error?.message || 'Registration failed');
      return;
    }

    const brand = res.data?.brand || res.data;
    localStorage.setItem('inflx_brand', JSON.stringify(brand));
    // Registration succeeded — the draft has served its purpose. Leaving it
    // would bounce a returning user back into the register step.
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }

    const meRes = await brandApi.getMe().catch(() => null);
    if (meRes?.success) {
      // /brands/me returns { brand, user_status } — there is no `user` key, so
      // the previous read was always undefined and inflx_user kept the literal
      // 'Brand User' placeholder sent during verify-otp. The real contact name
      // comes back on the brand row as `name` (aliased from users.name in
      // brand.controller.js), and the status as `user_status`.
      const b = meRes.data?.brand || meRes.data;
      let stored = null;
      try { stored = JSON.parse(localStorage.getItem('inflx_user') || 'null'); } catch { /* ignore */ }
      if (stored && b) {
        localStorage.setItem('inflx_user', JSON.stringify({
          ...stored,
          ...(b.name ? { name: b.name } : {}),
          ...(meRes.data?.user_status ? { status: meRes.data.user_status } : {}),
        }));
      }
    }

    router.push('/dashboard');
  }

  /* ── Shared input styles (locked palette) ─────────────────────────── */
  const labelClass = 'block text-xs font-semibold text-[#18181B] mb-2';
  const inputClass = 'w-full border-[1.5px] border-[#D4D4D8] rounded-[12px] px-3.5 py-3 text-sm text-[#0A0A0A] bg-white outline-none focus:border-[#FFC107] focus:shadow-[0_0_0_4px_rgba(255,193,7,0.18)] transition';
  const selectClass = inputClass + ' appearance-none bg-no-repeat bg-[right_14px_center] pr-10 bg-[url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'14\' height=\'14\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2371717A\' stroke-width=\'2.4\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")]';
  const monoInputClass = inputClass + " font-['JetBrains_Mono',ui-monospace,monospace] tracking-wider";
  const btnPrimary = 'w-full py-3.5 bg-[#FFC107] hover:bg-[#E0A800] text-[#0A0A0A] font-display font-bold rounded-[12px] text-sm disabled:opacity-40 disabled:cursor-not-allowed transition';
  const btnGhost   = 'w-full mt-1 py-2.5 text-xs font-semibold text-[#52525B] hover:text-[#0A0A0A] transition';
  const reqAst     = <span className="text-[#E8401A] ml-0.5">*</span>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] px-4 py-10 font-body">
      <div className="w-full max-w-[420px]">

        {/* ── Brand mark — Logo placeholder ── */}
        <div className="text-center mb-7">
          <Logo tone="dark" size="md" />
          <div className="mt-3 text-xs font-medium text-[#71717A] tracking-[0.3px]">Brand workspace</div>
        </div>

        {/* ── Card ── */}
        <div className="bg-white border border-[#E4E4E7] rounded-[20px] p-7 shadow-[0_1px_2px_rgba(0,0,0,0.02),0_12px_32px_-16px_rgba(0,0,0,0.08)]">

          {/* ══════════ STEP 1: PHONE ══════════ */}
          {step === 'phone' && (
            <form onSubmit={handleSendOtp}>
              <h1 className="font-display text-[22px] font-bold text-[#0A0A0A] -tracking-[0.4px] mb-1.5">Welcome back</h1>
              <p className="text-[13.5px] text-[#52525B] mb-5 leading-relaxed">
                Sign in with your mobile number to manage your campaigns, contracts and conversions.
              </p>

              <div className="mb-4">
                <label className={labelClass}>Mobile number</label>
                <div className="flex border-[1.5px] border-[#D4D4D8] rounded-[12px] overflow-hidden bg-white focus-within:border-[#FFC107] focus-within:shadow-[0_0_0_4px_rgba(255,193,7,0.18)] transition">
                  <span className="px-3.5 py-3 bg-[#F4F4F5] text-sm font-semibold text-[#0A0A0A] border-r border-[#E4E4E7] font-['JetBrains_Mono',ui-monospace,monospace] flex items-center gap-1.5">
                    🇮🇳 +91
                  </span>
                  <input
                    type="tel"
                    name="login-phone"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    className="flex-1 px-3.5 py-3 text-[15px] text-[#0A0A0A] outline-none bg-transparent font-['JetBrains_Mono',ui-monospace,monospace] tracking-wider"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    data-1p-ignore
                    data-lpignore="true"
                    required
                  />
                </div>
                <div className="mt-2 text-[11.5px] text-[#71717A]">We'll send a 6-digit OTP to verify your number.</div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-[#FDEEE9] border border-[#E8401A]/20 rounded-[10px] text-xs text-[#B91C1C] font-medium">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading || phone.length < 10} className={btnPrimary}>
                {loading ? 'Sending…' : 'Send OTP'}
              </button>

              <div className="text-center text-[11.5px] text-[#71717A] mt-5">
                By continuing you agree to our{' '}
                <a href="#" className="text-[#0A0A0A] border-b border-dotted border-[#A1A1AA]">Terms</a>
                {' '}&amp;{' '}
                <a href="#" className="text-[#0A0A0A] border-b border-dotted border-[#A1A1AA]">Privacy Policy</a>.
              </div>
            </form>
          )}

          {/* ══════════ STEP 2: OTP ══════════ */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp}>
              <h1 className="font-display text-[22px] font-bold text-[#0A0A0A] -tracking-[0.4px] mb-1.5">Enter the 6-digit code</h1>
              <p className="text-[13.5px] text-[#52525B] mb-5">
                Sent to <span className="font-['JetBrains_Mono',ui-monospace,monospace] font-semibold text-[#0A0A0A]">+91 {phone}</span>
              </p>

              <div className="grid grid-cols-6 gap-2 mb-4">
                {Array.from({ length: 6 }).map((_, i) => {
                  const filled = !!otp[i];
                  return (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      // Only the first input advertises one-time-code so the
                      // browser's SMS autofill fills all 6 in one go via the
                      // onChange paste branch below. Subsequent inputs are
                      // off-autocomplete to stop WebOTP from racing keystrokes.
                      autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      value={otp[i] || ''}
                      onChange={e => {
                        // Functional state update — guarantees we read the
                        // latest committed `otp`, not a stale closure when
                        // user types faster than React re-renders.
                        const raw = e.target.value.replace(/\D/g, '');
                        if (raw.length > 1) {
                          // Paste / SMS autofill — distribute starting at box i.
                          setOtp(prev => {
                            const a = prev.split('');
                            for (let k = 0; k < raw.length && i + k < 6; k++) a[i + k] = raw[k];
                            return a.join('').slice(0, 6);
                          });
                          const focusIdx = Math.min(5, i + raw.length - 1);
                          document.getElementById(`otp-${focusIdx}`)?.focus();
                          return;
                        }
                        // Single-digit keystroke (the fast-typing path).
                        const v = raw.slice(0, 1);
                        setOtp(prev => {
                          const a = prev.split('');
                          a[i] = v;
                          return a.join('').slice(0, 6);
                        });
                        if (v && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Backspace' && !otp[i] && i > 0) document.getElementById(`otp-${i - 1}`)?.focus();
                      }}
                      className={`h-[56px] rounded-[12px] text-center font-['JetBrains_Mono',ui-monospace,monospace] font-bold text-[22px] text-[#0A0A0A] outline-none border-[1.5px] transition ${filled ? 'bg-[#FFFDEB] border-[#FFC107]' : 'bg-white border-[#D4D4D8] focus:border-[#FFC107] focus:shadow-[0_0_0_4px_rgba(255,193,7,0.18)]'}`}
                    />
                  );
                })}
              </div>

              <div className="text-center text-[12.5px] text-[#52525B] mb-4">
                Didn't get it?{' '}
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resending}
                  className="text-[#E0A800] font-semibold hover:text-[#CA8A04] disabled:opacity-50"
                >
                  {resending ? 'Resending…' : 'Resend OTP'}
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-[#FDEEE9] border border-[#E8401A]/20 rounded-[10px] text-xs text-[#B91C1C] font-medium">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading || otp.length < 6} className={btnPrimary}>
                {loading ? 'Verifying…' : 'Verify & continue'}
              </button>
              <button type="button" onClick={() => { setStep('phone'); setOtp(''); setError(''); }} className={btnGhost}>
                ← Change number
              </button>
            </form>
          )}

          {/* ══════════ STEP 3: REGISTER ══════════ */}
          {step === 'register' && (
            <form onSubmit={handleRegister}>
              <h1 className="font-display text-[22px] font-bold text-[#0A0A0A] -tracking-[0.4px] mb-1.5">Tell us about your business</h1>
              <p className="text-[13.5px] text-[#52525B] mb-5 leading-relaxed">
                A couple of minutes — admin uses this to approve your account.
              </p>

              {restored && (
                <div className="mb-5 flex items-start gap-2.5 px-3.5 py-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-[12px]">
                  <span className="text-[13px] leading-none mt-0.5">💾</span>
                  <div className="text-[12.5px] text-[#78350F] leading-relaxed">
                    We kept what you had already filled in. Check every field before
                    submitting — you can edit anything here, including your location.
                  </div>
                </div>
              )}

              {/* Section 1 — Business */}
              <div className="flex items-center gap-2 text-[11px] font-bold text-[#18181B] uppercase tracking-[0.6px] mb-3">
                <span className="w-[18px] h-[18px] rounded-full bg-[#FFC107] text-[#0A0A0A] font-display font-bold text-[10px] inline-flex items-center justify-center">1</span>
                <span>Business</span>
              </div>

              <div className="mb-3.5">
                <label className={labelClass}>Your name{reqAst}</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Your full name" className={inputClass} required />
              </div>

              <div className="mb-3.5">
                <label className={labelClass}>Business name{reqAst}</label>
                <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)}
                  placeholder="e.g. Label Fern" className={inputClass} required />
              </div>

              {/* Docs/THE_CUT.md pass 0 — one business type, so it is stated rather
                  than chosen. Said plainly here so an owner of a different kind of
                  business finds out now, on the form, and not after building a
                  catalogue no shopper can reach. */}
              <div className="mb-3.5">
                <label className={labelClass}>Business type</label>
                <div className="rounded-md border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2.5">
                  <div className="text-[13px] font-semibold text-[#18181B]">{CATEGORY_LABEL}</div>
                  <div className="mt-0.5 text-[11px] text-[#71717A]">
                    INFLX is a fashion platform. Other kinds of business are not supported yet.
                  </div>
                </div>
              </div>

              {/* Item 2 — what the brand sells, from the eight fashion sub-categories. Required:
                  creators filter the brands that may invite them by these. */}
              <div className="mb-3.5">
                <label className={labelClass}>What you sell <span className="text-[#E8401A]">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {subCategoryOptions.map(opt => {
                    const on = subCategories.includes(opt.code);
                    return (
                      <button type="button" key={opt.code} onClick={() => toggleSubCategory(opt.code)}
                        className={on
                          ? 'rounded-full border border-[#0A0A0A] bg-[#0A0A0A] text-white text-[12.5px] font-semibold px-3 py-1.5'
                          : 'rounded-full border border-[#D4D4D8] bg-white text-[#52525B] text-[12.5px] font-semibold px-3 py-1.5'}>
                        {on ? '✓ ' : ''}{opt.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-1.5 text-[11px] text-[#71717A]">Pick every category you sell. You can change this later in Business details.</div>
              </div>

              {/* Section 2 — Location */}
              <div className="border-t border-[#E4E4E7] mt-5 pt-5">
                <div className="flex items-center gap-2 text-[11px] font-bold text-[#18181B] uppercase tracking-[0.6px] mb-3">
                  <span className="w-[18px] h-[18px] rounded-full bg-[#FFC107] text-[#0A0A0A] font-display font-bold text-[10px] inline-flex items-center justify-center">2</span>
                  <span>Location</span>
                </div>

                {/* Item 5 — the same four-part address the phones take: street typed,
                    pincode typed, state picked, nearest major city picked from that state. */}
                <div className="mb-3.5">
                  <label className={labelClass}>Business address{reqAst}</label>
                  <input type="text" value={addressLine} onChange={e => setAddressLine(e.target.value)}
                    placeholder={STORE_COPY.streetPlaceholder} maxLength={STREET_MAX} className={inputClass} required />
                  <div className="mt-1.5 text-[11px] text-[#71717A]">{STORE_COPY.streetHint}</div>
                </div>
                <div className="mb-3.5">
                  <label className={labelClass}>Pincode{reqAst}</label>
                  <input type="text" inputMode="numeric" maxLength={6} value={pincode}
                    onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit" className={monoInputClass} required />
                </div>
                <div className="mb-3.5">
                  <label className={labelClass}>State{reqAst}</label>
                  <select value={stateId ?? ''} onChange={e => pickState(e.target.value)}
                    className={selectClass} required>
                    <option value="">Select your state</option>
                    {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="mb-4">
                  <label className={labelClass}>{STORE_COPY.city}{reqAst}</label>
                  <select value={cityId ?? ''} onChange={e => setCityId(toId(e.target.value))}
                    className={selectClass} disabled={!selectedState} required>
                    <option value="">{selectedState ? STORE_COPY.cityPick : 'Pick a state first'}</option>
                    {cityOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <div className="mt-1.5 text-[11px] text-[#71717A]">{STORE_COPY.cityHint}</div>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-[#FDEEE9] border border-[#E8401A]/20 rounded-[10px] text-xs text-[#B91C1C] font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !name.trim() || !businessName.trim() || subCategories.length === 0 || !addressLine.trim() || pincode.length !== 6 || !stateId || !cityId}
                className={btnPrimary}
              >
                {loading ? 'Registering…' : 'Complete registration'}
              </button>

              <div className="text-center text-[11.5px] text-[#71717A] mt-4">
                Admin review takes &lt; 24 hours. You'll get an SMS when approved.
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
