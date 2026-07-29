'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, brandApi, geoApi } from '../../lib/api';
import Logo from '../../../shared/components/Logo';

// Device-local draft of the registration step. Cleared on successful
// register, and only ever read when a session token already exists.
const DRAFT_KEY = 'inflx_brand_signup_draft';

const INDUSTRY_HIERARCHY = [
  { group: 'Food & Dining', categories: [
    { value: 'restaurant', label: 'Restaurant & Cafe' },
    { value: 'bakery', label: 'Bakery' },
    { value: 'packaged_food', label: 'Packaged Food' },
    { value: 'grocery', label: 'Grocery & Supermarket' },
  ]},
  // Shopping & Retail is deliberately collapsed to a single fashion business
  // type. The `fashion` schema already carries Footwear, Jewellery, Accessories
  // and Bags as sections (backend/public/schemas/fashion.json), so one category
  // covers everything the founder is onboarding today — no multi-select, no new
  // column, and `category` stays the single key that resolves a schema.
  // The other retail types (electronics, furniture, optical, pet_shop,
  // flowers_gifting, hardware) and the standalone footwear/jewellery schemas
  // are intentionally not offered yet; existing brands on those values are
  // untouched and still resolve their own schemas.
  { group: 'Shopping & Retail', categories: [
    { value: 'fashion', label: 'Fashion — Clothing, Footwear, Jewellery & Accessories' },
  ]},
  { group: 'Beauty & Grooming', categories: [
    { value: 'salon', label: 'Salon & Beauty Parlour' },
    { value: 'home_beauty', label: 'Home Beauty / At-home Salon' },
    { value: 'pet_grooming', label: 'Pet Grooming' },
  ]},
  { group: 'Health & Fitness', categories: [
    { value: 'gym_fitness', label: 'Gym & Fitness Studio' },
    { value: 'clinic_doctor', label: 'Clinic & Doctor' },
    { value: 'dental_clinic', label: 'Dental Clinic' },
    { value: 'diagnostic_lab', label: 'Diagnostic Lab' },
    { value: 'coaching_center', label: 'Coaching & Tutoring Center' },
  ]},
  { group: 'Travel & Rentals', categories: [
    { value: 'car_rental', label: 'Car Rental' },
    { value: 'bike_rental', label: 'Bike Rental' },
    { value: 'travel_packages', label: 'Travel Packages & Tours' },
    { value: 'hotel_homestay', label: 'Hotel & Homestay' },
  ]},
  { group: 'Home Services', categories: [
    { value: 'home_services', label: 'Home Services (Plumbing, Electrician, AC)' },
    { value: 'pest_control', label: 'Pest Control' },
    { value: 'laundry', label: 'Laundry & Dry Cleaning' },
    { value: 'interior_design', label: 'Interior Design Consultation' },
    { value: 'coworking_space', label: 'Co-working Space' },
  ]},
  { group: 'Events & Professional', categories: [
    { value: 'function_hall', label: 'Event Venue & Banquet Hall' },
    { value: 'wedding_planner', label: 'Wedding Planner' },
    { value: 'photography', label: 'Photography Studio' },
    { value: 'florist', label: 'Florist' },
    { value: 'legal_ca', label: 'Legal / CA Consultation' },
  ]},
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman & Nicobar', 'Chandigarh', 'Dadra & Nagar Haveli and Daman & Diu',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

export default function LoginPage() {
  const router = useRouter();
  // Steps: phone -> otp -> register (name+business+category on one screen)
  const [step, setStep]               = useState('phone');
  const [phone, setPhone]             = useState('');
  const [otp, setOtp]                 = useState('');
  const [name, setName]               = useState('');
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry]       = useState('');
  const [category, setCategory]       = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity]               = useState('');
  const [state, setStateField]        = useState('');
  const [pincode, setPincode]         = useState('');
  const [referralCode, setReferralCode] = useState(''); // optional — D-1 intake
  // Location capture (contract: brand-register-location-picker).
  // 'search' (Places autocomplete) | 'link' (Google Maps URL) | 'manual'
  const [locMode, setLocMode]         = useState('search');
  const [locQuery, setLocQuery]       = useState('');
  const [locSugs, setLocSugs]         = useState([]);
  const [mapsUrl, setMapsUrl]         = useState('');
  const [locating, setLocating]       = useState(false);
  const [coords, setCoords]           = useState(null);   // { lat, lng }
  const [locLocality, setLocLocality] = useState('');
  const [locFormatted, setLocFormatted] = useState('');
  const debounceRef = useRef(null);
  // 'idle' | 'searching' | 'empty' | 'error' — the search box used to give no
  // feedback at all, so a slow or failed lookup was indistinguishable from a
  // dead field. The backend cold-starts and the first call can take 8s+.
  const [locState, setLocState] = useState('idle');
  const locSeqRef = useRef(0);
  const placesSessionRef = useRef(Math.random().toString(36).slice(2) + Date.now().toString(36));
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
  // wrong Google Maps link and tries to start over.
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
      setIndustry(d.industry || '');
      setCategory(d.category || '');
      setAddressLine(d.addressLine || '');
      setCity(d.city || '');
      setStateField(d.state || '');
      setPincode(d.pincode || '');
      setReferralCode(d.referralCode || '');
      setLocMode(d.locMode || 'search');
      setMapsUrl(d.mapsUrl || '');
      setCoords(d.coords || null);
      setLocLocality(d.locLocality || '');
      setLocFormatted(d.locFormatted || '');
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
        phone, name, businessName, industry, category, addressLine, city,
        state, pincode, referralCode, locMode, mapsUrl, coords,
        locLocality, locFormatted,
      }));
    } catch { /* quota or private mode — persistence is best-effort */ }
  }, [step, phone, name, businessName, industry, category, addressLine, city,
      state, pincode, referralCode, locMode, mapsUrl, coords, locLocality, locFormatted]);

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
    document.cookie = `inflx_token=${access_token}; path=/; max-age=2592000; SameSite=Strict`;

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

  /* ── Location capture handlers ─────────────────────────────────────── */

  function applyPlace(d, fallbackLabel) {
    if (d.lat != null && d.lng != null) setCoords({ lat: d.lat, lng: d.lng });
    setLocLocality(d.area_name || d.locality || '');
    setLocFormatted(d.formatted_address || '');
    if (d.formatted_address) setAddressLine(d.formatted_address);
    else if (fallbackLabel) setAddressLine(fallbackLabel);
    if (d.city) setCity(d.city);
    // Google returns official names ("Jammu and Kashmir", "Andaman and Nicobar
    // Islands") while INDIAN_STATES uses ampersands, so an exact includes()
    // silently dropped the autofill for those. Match on a normalised form.
    if (d.state) {
      const norm = s => String(s).toLowerCase().replace(/\s*&\s*|\s+and\s+/g, ' and ').replace(/\s+/g, ' ').trim();
      const hit = INDIAN_STATES.find(s => norm(s) === norm(d.state));
      if (hit) setStateField(hit);
    }
    if (d.pincode && /^[0-9]{6}$/.test(String(d.pincode))) setPincode(String(d.pincode));
  }

  function onLocQueryChange(v) {
    setLocQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < 3) { setLocSugs([]); setLocState('idle'); return; }
    setLocState('searching');
    debounceRef.current = setTimeout(async () => {
      // Guard against out-of-order responses: the API can take several seconds
      // on a cold backend, so a slow reply for an earlier query must not
      // overwrite the results of a later one.
      const seq = ++locSeqRef.current;
      const res = await geoApi.placesAutocomplete(v.trim(), placesSessionRef.current).catch(() => null);
      if (seq !== locSeqRef.current) return;

      if (!res?.success) {
        // The backend answers 200 with an empty list for a missing/rejected
        // Google key AND for a genuine no-match, so a null/failed response is
        // the only case we can honestly call an error.
        setLocSugs([]);
        setLocState('error');
        return;
      }
      const preds = res.data?.predictions || [];
      setLocSugs(preds);
      setLocState(preds.length ? 'idle' : 'empty');
    }, 350);
  }

  async function pickSuggestion(p) {
    setLocSugs([]);
    setLocState('idle');
    locSeqRef.current++;   // cancel any in-flight lookup for the old query
    setLocQuery(p.description || p.main || '');
    const res = await geoApi.placeDetails(p.place_id, placesSessionRef.current).catch(() => null);
    if (res?.success && res.data) applyPlace(res.data, p.description);
    else setError('Could not load that place — pick another or switch to Manual.');
  }

  async function locateMapsUrl() {
    if (!mapsUrl.trim()) return;
    setError('');
    setLocating(true);
    const res = await geoApi
      .geocodeMapsUrl(mapsUrl.trim(), businessName.trim() || undefined, city.trim() || undefined)
      .catch(() => null);
    setLocating(false);
    if (res?.success && res.data?.verified) applyPlace(res.data);
    else setError("Couldn't read a location from that link. In Google Maps use Share → Copy link, paste it here — or use Search / Manual.");
  }

  // Step 3: Register brand
  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (!businessName.trim()) { setError('Please enter your business name'); return; }
    if (!category) { setError('Please select a category'); return; }
    if (!addressLine.trim()) { setError('Please enter your business address'); return; }
    if (!city.trim()) { setError('Please enter your city'); return; }
    if (!state.trim()) { setError('Please select your state'); return; }
    if (!/^[0-9]{6}$/.test(pincode.trim())) { setError('Pincode must be 6 digits'); return; }

    setLoading(true);

    const res = await brandApi.register({
      name:          name.trim(),
      business_name: businessName.trim(),
      category,
      address_line:  addressLine.trim(),
      city:          city.trim(),
      state:         state.trim(),
      pincode:       pincode.trim(),
      ...(coords ? {
        latitude:  coords.lat,
        longitude: coords.lng,
        ...(locLocality  && { locality: locLocality }),
        ...(locFormatted && { formatted_address: locFormatted }),
      } : {}),
      ...(locMode === 'link' && mapsUrl.trim() ? { google_maps_url: mapsUrl.trim() } : {}),
      ...(referralCode.trim() ? { referral_code: referralCode.trim() } : {}),
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
                <span className="ml-2 inline-block bg-[#FFF7CC] text-[#6B5A00] font-['JetBrains_Mono',ui-monospace,monospace] font-semibold text-[11px] px-2 py-0.5 rounded">
                  dev · 000000
                </span>
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
                  placeholder="e.g. Spice Garden Restaurant" className={inputClass} required />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3.5">
                <div>
                  <label className={labelClass}>Industry{reqAst}</label>
                  <select value={industry} onChange={e => { setIndustry(e.target.value); setCategory(''); }}
                    className={selectClass} required>
                    <option value="">Select…</option>
                    {INDUSTRY_HIERARCHY.map(g => (
                      <option key={g.group} value={g.group}>{g.group}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Business type{reqAst}</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    className={selectClass} required disabled={!industry}>
                    <option value="">{industry ? 'Select…' : 'Pick industry first'}</option>
                    {INDUSTRY_HIERARCHY.find(g => g.group === industry)?.categories.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Section 2 — Location */}
              <div className="border-t border-[#E4E4E7] mt-5 pt-5">
                <div className="flex items-center gap-2 text-[11px] font-bold text-[#18181B] uppercase tracking-[0.6px] mb-3">
                  <span className="w-[18px] h-[18px] rounded-full bg-[#FFC107] text-[#0A0A0A] font-display font-bold text-[10px] inline-flex items-center justify-center">2</span>
                  <span>Location</span>
                </div>

                {/* Mode pills — Search (default) / Maps link / Manual */}
                <div className="flex gap-1.5 mb-3">
                  {[['search', '🔍 Search place'], ['link', '🔗 Maps link'], ['manual', '✍️ Manual']].map(([m, lbl]) => (
                    <button key={m} type="button" onClick={() => { setLocMode(m); setLocSugs([]); }}
                      className={`flex-1 py-2 px-1 rounded-[10px] text-[11.5px] font-semibold border transition-colors ${
                        locMode === m ? 'border-[#FFC107] bg-[#FFFBEB] text-[#18181B]' : 'border-[#E4E4E7] bg-white text-[#71717A]'}`}>
                      {lbl}
                    </button>
                  ))}
                </div>

                {locMode === 'search' && (
                  <div className="mb-3.5 relative">
                    <label className={labelClass}>Search your business or area</label>
                    <input type="text" value={locQuery} onChange={e => onLocQueryChange(e.target.value)}
                      placeholder="Type shop name or area… (min 3 letters)" className={inputClass} />

                    {locState === 'searching' && (
                      <div className="mt-1.5 text-[11.5px] text-[#71717A]">
                        Searching… the first lookup can take a few seconds.
                      </div>
                    )}
                    {locState === 'empty' && (
                      <div className="mt-1.5 text-[11.5px] text-[#71717A]">
                        No places matched. Try a shorter name or a nearby landmark — or use
                        <button type="button" onClick={() => setLocMode('link')} className="mx-1 font-semibold text-[#18181B] underline underline-offset-2">Maps link</button>
                        instead.
                      </div>
                    )}
                    {locState === 'error' && (
                      <div className="mt-1.5 text-[11.5px] text-[#B91C1C]">
                        Search isn&apos;t responding right now.
                        <button type="button" onClick={() => onLocQueryChange(locQuery)} className="mx-1 font-semibold underline underline-offset-2">Retry</button>
                        or switch to
                        <button type="button" onClick={() => setLocMode('link')} className="mx-1 font-semibold underline underline-offset-2">Maps link</button>
                        or
                        <button type="button" onClick={() => setLocMode('manual')} className="ml-1 font-semibold underline underline-offset-2">Manual</button>.
                      </div>
                    )}

                    {locSugs.length > 0 && (
                      <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-[#E4E4E7] rounded-[10px] overflow-hidden shadow-lg">
                        {locSugs.slice(0, 5).map(p => (
                          <button key={p.place_id} type="button" onClick={() => pickSuggestion(p)}
                            className="block w-full text-left px-3 py-2 border-b border-[#F4F4F5] last:border-0 hover:bg-[#FFFBEB]">
                            <span className="block text-[13px] font-semibold text-[#18181B]">{p.main}</span>
                            <span className="block text-[11.5px] text-[#71717A]">{p.secondary}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {locMode === 'link' && (
                  <div className="mb-3.5">
                    <label className={labelClass}>Paste your Google Maps link</label>
                    <div className="flex gap-2">
                      <input type="url" value={mapsUrl} onChange={e => setMapsUrl(e.target.value)}
                        placeholder="https://maps.app.goo.gl/…" className={inputClass} />
                      <button type="button" onClick={locateMapsUrl} disabled={locating || !mapsUrl.trim()}
                        className="shrink-0 px-4 rounded-[10px] bg-[#18181B] text-white text-[12px] font-semibold disabled:opacity-40">
                        {locating ? '…' : '📍 Locate'}
                      </button>
                    </div>
                    <div className="text-[11px] text-[#71717A] mt-1.5">In Google Maps: Share → Copy link → paste here.</div>
                  </div>
                )}

                {coords && (
                  <div className="inline-flex items-center gap-1.5 mb-3 px-2.5 py-1 bg-[#ECFDF5] border border-[#A7F3D0] rounded-full text-[11.5px] font-semibold text-[#047857]">
                    ✓ Location captured{locLocality ? ` — ${locLocality}` : ''}
                  </div>
                )}

                <div className="mb-3.5">
                  <label className={labelClass}>Business address{reqAst}</label>
                  <input type="text" value={addressLine} onChange={e => setAddressLine(e.target.value)}
                    placeholder="Building, street, area" className={inputClass} required />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3.5">
                  <div>
                    <label className={labelClass}>City{reqAst}</label>
                    <input type="text" value={city} onChange={e => setCity(e.target.value)}
                      placeholder="e.g. Vijayawada" className={inputClass} required />
                  </div>
                  <div>
                    <label className={labelClass}>Pincode{reqAst}</label>
                    <input type="text" inputMode="numeric" maxLength={6} value={pincode}
                      onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit" className={monoInputClass} required />
                  </div>
                </div>
                <div className="mb-4">
                  <label className={labelClass}>State{reqAst}</label>
                  <select value={state} onChange={e => setStateField(e.target.value)}
                    className={selectClass} required>
                    <option value="">Select your state</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="mb-4">
                  <label className={labelClass}>Referral code <span className="text-[#A1A1AA] font-normal">(if any)</span></label>
                  <input type="text" value={referralCode}
                    onChange={e => setReferralCode(e.target.value.toUpperCase().trim())}
                    placeholder="e.g. INFLX-7QK4M2" className={monoInputClass} />
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-[#FDEEE9] border border-[#E8401A]/20 rounded-[10px] text-xs text-[#B91C1C] font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !name.trim() || !businessName.trim() || !category || !addressLine.trim() || !city.trim() || !state.trim() || pincode.length !== 6}
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
