'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState('phone'); // phone | otp
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSendOtp(e) {
    e.preventDefault();
    setError('');
    const formatted = phone.startsWith('+91') ? phone : `+91${phone}`;
    setLoading(true);
    const res = await authApi.sendOtp(formatted);
    setLoading(false);
    if (res.success) {
      setStep('otp');
    } else {
      setError(res.error?.message || 'Failed to send OTP');
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError('');
    const formatted = phone.startsWith('+91') ? phone : `+91${phone}`;
    setLoading(true);
    const res = await authApi.verifyOtp(formatted, otp);
    setLoading(false);
    if (res.success) {
      const { access_token, user } = res.data;
      if (user.role !== 'admin') {
        setError('This portal is for admins only.');
        return;
      }
      localStorage.setItem('inflx_token', access_token);
      localStorage.setItem('inflx_user', JSON.stringify(user));
      // Set cookie for middleware
      document.cookie = `inflx_token=${access_token}; path=/; max-age=900`;
      router.push('/dashboard');
    } else {
      setError(res.error?.message || 'Invalid OTP');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-deep via-navy to-navy-mid">
      <div className="bg-white rounded-2xl p-8 w-80 shadow-2xl">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="font-display text-2xl font-extrabold text-navy-deep mb-1">
            INFL<span className="bg-gradient-to-r from-red to-orange bg-clip-text text-transparent">X</span>
          </div>
          <div className="text-xs text-t3 font-semibold uppercase tracking-widest">Admin Dashboard</div>
        </div>

        {step === 'phone' ? (
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
                  className="flex-1 px-3 py-2.5 text-sm text-t1 outline-none bg-white"
                  required
                />
              </div>
            </div>
            {error && <div className="mb-3 p-2.5 bg-red-pale rounded-lg text-xs text-red font-medium">{error}</div>}
            <button
              type="submit"
              disabled={loading || phone.length < 10}
              className="w-full py-3 bg-gradient-to-r from-red to-orange text-white font-bold rounded-lg text-sm disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <div className="mb-1 text-sm text-t2 text-center">OTP sent to +91{phone}</div>
            <div className="text-xs text-t3 text-center mb-4">(dev: use 000000)</div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-t2 uppercase tracking-wider mb-2">Enter OTP</label>
              <div className="flex gap-2 justify-center">
                {Array.from({ length: 6 }).map((_, i) => (
                  <input
                    key={i}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={otp[i] || ''}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      const newOtp = otp.split('');
                      newOtp[i] = val;
                      const joined = newOtp.join('').slice(0, 6);
                      setOtp(joined);
                      if (val && i < 5) {
                        const next = document.getElementById(`otp-${i+1}`);
                        next?.focus();
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Backspace' && !otp[i] && i > 0) {
                        document.getElementById(`otp-${i-1}`)?.focus();
                      }
                    }}
                    id={`otp-${i}`}
                    className="w-10 h-12 border-2 border-border2 rounded-xl text-center text-lg font-bold text-t1 outline-none focus:border-navy focus:shadow-[0_0_0_3px_#EEF1FB]"
                  />
                ))}
              </div>
            </div>
            {error && <div className="mb-3 p-2.5 bg-red-pale rounded-lg text-xs text-red font-medium">{error}</div>}
            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full py-3 bg-gradient-to-r from-red to-orange text-white font-bold rounded-lg text-sm disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button type="button" onClick={() => setStep('phone')} className="w-full mt-2 py-2 text-xs text-t3 hover:text-t2">
              ← Change number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
