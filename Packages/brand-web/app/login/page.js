'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, brandApi } from '../../lib/api';

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
    { value: 'fashion_walkin', label: 'Fashion & Apparel (Walk-in)' },
    { value: 'fashion_online', label: 'Fashion & Apparel (Online)' },
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

export default function LoginPage() {
  const router = useRouter();
  // steps: phone | otp | business
  const [step, setStep]               = useState('phone');
  const [phone, setPhone]             = useState('');
  const [otp, setOtp]                 = useState('');
  const [name, setName]               = useState('');
  const [needsName, setNeedsName]     = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [resending, setResending]     = useState(false);
  const [error, setError]             = useState('');

  const fmt = phone.startsWith('+91') ? phone : `+91${phone}`;

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
    setError('');
    setOtp('');
    setNeedsName(false);
    setResending(true);
    const res = await authApi.sendOtp(fmt);
    setResending(false);
    if (!res.success) setError(res.error?.message || 'Failed to resend OTP');
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError('');
    // If backend told us name is required, enforce it before the call
    if (needsName && !name.trim()) { setError('Please enter your full name'); return; }
    setLoading(true);
    const res = await authApi.verifyOtp(fmt, otp, name.trim() || undefined);
    setLoading(false);
    // New user — backend requires name; show the field and let them retry
    if (!res.success && res.error?.field === 'name') {
      setNeedsName(true);
      setError('Please enter your full name to create your account');
      return;
    }
    if (!res.success) { setError(res.error?.message || 'Invalid OTP'); return; }

    const { access_token, user } = res.data;
    if (user.role !== 'brand') { setError('This portal is for brands only.'); return; }

    localStorage.setItem('inflx_token', access_token);
    localStorage.setItem('inflx_user', JSON.stringify(user));
    document.cookie = `inflx_token=${access_token}; path=/; max-age=900; Secure; SameSite=Strict`;

    // Check if brand profile exists
    const brandRes = await brandApi.getMe();
    if (!brandRes.success) {
      // New user — collect business details
      setStep('business');
      return;
    }

    const brand = brandRes.data?.brand || brandRes.data;
    localStorage.setItem('inflx_brand', JSON.stringify(brand));
    if (brand?.status === 'pending')  { router.push('/waiting');  return; }
    if (brand?.status === 'rejected') { router.push('/rejected'); return; }
    router.push('/dashboard/campaigns');
  }

  async function handleRegisterBrand(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await brandApi.register({ business_name: businessName.trim(), category });
    setLoading(false);
    if (!res.success) { setError(res.error?.message || 'Registration failed'); return; }

    const brand = res.data?.brand || res.data;
    localStorage.setItem('inflx_brand', JSON.stringify(brand));
    router.push('/waiting');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-deep via-navy to-navy-mid">
      <div className="bg-white rounded-2xl p-8 w-80 shadow-2xl">
        <div className="text-center mb-6">
          <div className="font-display text-2xl font-extrabold text-navy-deep mb-1">
            INFL<span className="bg-gradient-to-r from-red to-orange bg-clip-text text-transparent">X</span>
          </div>
          <div className="text-xs text-t3 font-semibold uppercase tracking-widest">Brand Dashboard</div>
        </div>

        {step === 'phone' && (
          <form onSubmit={handleSendOtp}>
            <div className="mb-4">
              <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-2">Phone Number</label>
              <div className="flex items-center border-2 border-border2 rounded-lg overflow-hidden focus-within:border-gold">
                <span className="px-3 py-2.5 bg-surface2 text-t2 text-sm font-medium border-r border-border2">+91</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  className="flex-1 px-3 py-2.5 text-sm text-t1 outline-none"
                  required
                />
              </div>
            </div>
            {error && <div className="mb-3 p-2.5 bg-red-pale rounded-lg text-xs text-red">{error}</div>}
            <button
              type="submit"
              disabled={loading || phone.length < 10}
              className="w-full py-3 bg-gradient-to-r from-red to-orange text-white font-bold rounded-lg text-sm disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp}>
            <div className="text-xs text-t3 text-center mb-4">
              OTP sent to +91{phone} <span className="text-t3">(dev: 000000)</span>
            </div>
            <div className="flex gap-2 justify-center mb-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={otp[i] || ''}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '');
                    const a = otp.split('');
                    a[i] = v;
                    const j = a.join('').slice(0, 6);
                    setOtp(j);
                    if (v && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Backspace' && !otp[i] && i > 0)
                      document.getElementById(`otp-${i - 1}`)?.focus();
                  }}
                  className="w-10 h-12 border-2 border-border2 rounded-xl text-center text-lg font-bold text-t1 outline-none focus:border-navy"
                />
              ))}
            </div>
            {needsName && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-2">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your full name"
                  autoFocus
                  className="w-full border-2 border-border2 rounded-lg px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold"
                />
              </div>
            )}
            {error && <div className="mb-3 p-2.5 bg-red-pale rounded-lg text-xs text-red">{error}</div>}
            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full py-3 bg-gradient-to-r from-red to-orange text-white font-bold rounded-lg text-sm disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resending}
              className="w-full mt-2 py-2 text-xs text-navy font-semibold hover:underline disabled:opacity-50"
            >
              {resending ? 'Resending...' : 'Resend OTP'}
            </button>
            <button type="button" onClick={() => setStep('phone')} className="w-full mt-1 py-2 text-xs text-t3 hover:text-t2">
              ← Change number
            </button>
          </form>
        )}

        {step === 'business' && (
          <form onSubmit={handleRegisterBrand}>
            <div className="text-xs text-t3 text-center mb-4">Tell us about your business</div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-2">Business Name</label>
              <input
                type="text"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                placeholder="e.g. Spice Garden Restaurant"
                className="w-full border-2 border-border2 rounded-lg px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-2">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full border-2 border-border2 rounded-lg px-3 py-2.5 text-sm text-t1 outline-none focus:border-gold bg-white"
                required
              >
                <option value="">Select your business type</option>
                {INDUSTRY_HIERARCHY.map(group => (
                  <optgroup key={group.group} label={group.group}>
                    {group.categories.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            {error && <div className="mb-3 p-2.5 bg-red-pale rounded-lg text-xs text-red">{error}</div>}
            <button
              type="submit"
              disabled={loading || !businessName.trim() || !category}
              className="w-full py-3 bg-gradient-to-r from-red to-orange text-white font-bold rounded-lg text-sm disabled:opacity-50"
            >
              {loading ? 'Registering...' : 'Complete Registration'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
