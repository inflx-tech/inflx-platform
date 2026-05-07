'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, brandApi } from '../../lib/api';

const INDUSTRY_HIERARCHY = [
  { group: 'Food & Dining', categories: [
    { value: 'restaurant', label: 'Restaurant & Cafe' },
    { value: 'bakery', label: 'Bakery' },
    { value: 'packaged_food', label: 'Packaged Food' },
    { value: 'grocery', label: 'Grocery & Supermarket' },
  ]},
  { group: 'Shopping & Retail', categories: [
    { value: 'fashion_walkin', label: 'Fashion & Apparel' },
    { value: 'electronics', label: 'Electronics & Gadgets' },
    { value: 'jewellery', label: 'Jewellery & Watches' },
    { value: 'footwear', label: 'Footwear' },
    { value: 'furniture', label: 'Home Decor & Furniture' },
    { value: 'optical', label: 'Optical / Eyewear' },
    { value: 'pet_shop', label: 'Pet Shops' },
    { value: 'flowers_gifting', label: 'Flowers & Gifting' },
    { value: 'hardware', label: 'Hardware & Building Materials' },
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

// Indian states + UTs — lifted from MoH&FW spelling. Kept in alpha order
// so the dropdown is easy to scan.
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  // Union Territories
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
  // Location — collected at registration so the brand profile is complete
  // by the time admin reviews the approval queue.
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity]               = useState('');
  const [state, setStateField]        = useState('');
  const [pincode, setPincode]         = useState('');
  const [loading, setLoading]         = useState(false);
  const [resending, setResending]     = useState(false);
  const [error, setError]             = useState('');

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

    // Try verifying with a dummy name first (for existing users)
    const res = await authApi.verifyOtp(fmt, otp, 'Brand User');
    setLoading(false);

    if (!res.success) {
      setError(res.error?.message || 'Invalid OTP');
      return;
    }

    const { access_token, user } = res.data;
    localStorage.setItem('inflx_token', access_token);
    localStorage.setItem('inflx_user', JSON.stringify(user));
    document.cookie = `inflx_token=${access_token}; path=/; max-age=900; SameSite=Strict`;

    // Branch by role. The web supports two roles — brand and admin —
    // and the backend already returns the right role for existing users.
    // For brand-new users, the verifyOtp call defaults to creating a
    // brand row, so we send them through brand registration. Influencers
    // and followers are mobile-only — kick them out with a clear error.
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

    // No role matched OR brand role with no brand profile yet → register flow
    setStep('register');
  }

  // Step 3: Register brand (name + business + category + location)
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

    // Single round-trip — backend's /brands/register now accepts name +
    // city + state and updates the users row, fixing the "Brand User"
    // placeholder that admin used to see.
    const res = await brandApi.register({
      name:          name.trim(),
      business_name: businessName.trim(),
      category,
      address_line:  addressLine.trim(),
      city:          city.trim(),
      state:         state.trim(),
      pincode:       pincode.trim(),
    });
    setLoading(false);

    if (!res.success) {
      setError(res.error?.message || 'Registration failed');
      return;
    }

    const brand = res.data?.brand || res.data;
    localStorage.setItem('inflx_brand', JSON.stringify(brand));

    // Refresh the cached user too — the backend just updated users.name
    // + city + state, so the next page load should reflect the real name.
    const meRes = await brandApi.getMe().catch(() => null);
    if (meRes?.success) {
      const updatedUser = meRes.data?.user;
      if (updatedUser) localStorage.setItem('inflx_user', JSON.stringify(updatedUser));
    }

    // Go to dashboard — pending approval banner will show there
    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-deep via-navy to-navy-mid">
      <div className="bg-white rounded-2xl p-8 w-96 shadow-2xl">
        <div className="text-center mb-6">
          <div className="font-display text-2xl font-extrabold text-navy-deep mb-1">
            INFL<span className="bg-gradient-to-r from-red to-orange bg-clip-text text-transparent">X</span>
          </div>
          <div className="text-xs text-t3 font-semibold uppercase tracking-widest">Brand Dashboard</div>
        </div>

        {/* ── STEP 1: Phone ── */}
        {step === 'phone' && (
          <form onSubmit={handleSendOtp}>
            <div className="mb-4">
              <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-2">Phone Number</label>
              <div className="flex items-center border-2 border-border2 rounded-lg overflow-hidden focus-within:border-gold">
                <span className="px-3 py-2.5 bg-surface2 text-t2 text-sm font-medium border-r border-border2">+91</span>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" className="flex-1 px-3 py-2.5 text-sm text-t1 outline-none" required />
              </div>
            </div>
            {error && <div className="mb-3 p-2.5 bg-red-pale rounded-lg text-xs text-red">{error}</div>}
            <button type="submit" disabled={loading || phone.length < 10} className="w-full py-3 bg-gradient-to-r from-red to-orange text-white font-bold rounded-lg text-sm disabled:opacity-50">
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        )}

        {/* ── STEP 2: OTP ── */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp}>
            <div className="text-xs text-t3 text-center mb-4">
              OTP sent to +91{phone} <span className="text-t3">(dev: 000000)</span>
            </div>
            <div className="flex gap-2 justify-center mb-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <input key={i} id={`otp-${i}`} type="text" inputMode="numeric" maxLength={1} value={otp[i] || ''}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '');
                    const a = otp.split(''); a[i] = v;
                    const j = a.join('').slice(0, 6); setOtp(j);
                    if (v && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Backspace' && !otp[i] && i > 0) document.getElementById(`otp-${i - 1}`)?.focus();
                  }}
                  className="w-10 h-12 border-2 border-border2 rounded-xl text-center text-lg font-bold text-t1 outline-none focus:border-navy"
                />
              ))}
            </div>
            {error && <div className="mb-3 p-2.5 bg-red-pale rounded-lg text-xs text-red">{error}</div>}
            <button type="submit" disabled={loading || otp.length < 6} className="w-full py-3 bg-gradient-to-r from-red to-orange text-white font-bold rounded-lg text-sm disabled:opacity-50">
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button type="button" onClick={handleResendOtp} disabled={resending} className="w-full mt-2 py-2 text-xs text-navy font-semibold hover:underline disabled:opacity-50">
              {resending ? 'Resending...' : 'Resend OTP'}
            </button>
            <button type="button" onClick={() => { setStep('phone'); setOtp(''); setError(''); }} className="w-full mt-1 py-2 text-xs text-t3 hover:text-t2">
              ← Change number
            </button>
          </form>
        )}

        {/* ── STEP 3: Register (Name + Business + Category — ONE screen) ── */}
        {step === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="text-xs text-t3 text-center mb-4">Almost done! Tell us about your business</div>
            <div className="mb-3">
              <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1.5">Your Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full border-2 border-border2 rounded-lg px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold" required />
            </div>
            <div className="mb-3">
              <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1.5">Business Name</label>
              <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)}
                placeholder="e.g. Spice Garden Restaurant"
                className="w-full border-2 border-border2 rounded-lg px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold" required />
            </div>
            <div className="mb-3">
              <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1.5">Industry</label>
              <select value={industry} onChange={e => { setIndustry(e.target.value); setCategory(''); }}
                className="w-full border-2 border-border2 rounded-lg px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold bg-white" required>
                <option value="">Select your industry</option>
                {INDUSTRY_HIERARCHY.map(g => (
                  <option key={g.group} value={g.group}>{g.group}</option>
                ))}
              </select>
            </div>
            {industry && (
              <div className="mb-3">
                <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1.5">Business Type</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full border-2 border-border2 rounded-lg px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold bg-white" required>
                  <option value="">Select your business type</option>
                  {INDUSTRY_HIERARCHY.find(g => g.group === industry)?.categories.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Business location — required so admin sees a complete profile
                in the approval queue. */}
            <div className="mb-3">
              <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1.5">Business Address</label>
              <input type="text" value={addressLine} onChange={e => setAddressLine(e.target.value)}
                placeholder="Building, street, area"
                className="w-full border-2 border-border2 rounded-lg px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold" required />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1.5">City</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)}
                  placeholder="e.g. Vijayawada"
                  className="w-full border-2 border-border2 rounded-lg px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1.5">Pincode</label>
                <input type="text" inputMode="numeric" maxLength={6} value={pincode}
                  onChange={e => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit"
                  className="w-full border-2 border-border2 rounded-lg px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold" required />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-1.5">State</label>
              <select value={state} onChange={e => setStateField(e.target.value)}
                className="w-full border-2 border-border2 rounded-lg px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold bg-white" required>
                <option value="">Select your state</option>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {error && <div className="mb-3 p-2.5 bg-red-pale rounded-lg text-xs text-red">{error}</div>}
            <button type="submit"
              disabled={loading || !name.trim() || !businessName.trim() || !category || !addressLine.trim() || !city.trim() || !state.trim() || pincode.length !== 6}
              className="w-full py-3 bg-gradient-to-r from-red to-orange text-white font-bold rounded-lg text-sm disabled:opacity-50">
              {loading ? 'Registering...' : 'Complete Registration'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
