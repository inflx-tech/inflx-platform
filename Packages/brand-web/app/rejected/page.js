'use client';
import { useState } from 'react';
import { brandApi } from '../../lib/api';
import Logo from '../../../shared/components/Logo';

export default function RejectedPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const brand = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('inflx_brand') || '{}') : {};

  async function handleResubmit() {
    setSubmitting(true);
    await brandApi.resubmit({ notes: 'Resubmitting application' });
    setSubmitting(false);
    setSubmitted(true);
  }

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] px-4 py-10 font-body">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-7">
          <Logo tone="dark" size="md" />
          <div className="mt-3 text-xs font-medium text-[#71717A] tracking-[0.3px]">Brand workspace</div>
        </div>
        <div className="bg-white border border-[#E4E4E7] rounded-[20px] p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.02),0_12px_32px_-16px_rgba(0,0,0,0.08)]">
          <div className="w-[76px] h-[76px] rounded-full bg-[#D1FAE5] mx-auto mb-5 flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h1 className="font-display text-[22px] font-bold text-[#0A0A0A] mb-2">Resubmitted</h1>
          <p className="text-sm text-[#52525B] leading-relaxed">Your application has been sent for review again. You'll get an SMS once it's approved.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] px-4 py-10 font-body">
      <div className="w-full max-w-[420px]">

        <div className="text-center mb-7">
          <Logo tone="dark" size="md" />
          <div className="mt-3 text-xs font-medium text-[#71717A] tracking-[0.3px]">Brand workspace</div>
        </div>

        <div className="bg-white border border-[#E4E4E7] rounded-[20px] p-7 text-center shadow-[0_1px_2px_rgba(0,0,0,0.02),0_12px_32px_-16px_rgba(0,0,0,0.08)]">

          <div className="w-[76px] h-[76px] rounded-full bg-[#FDEEE9] mx-auto mb-5 flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>

          <h1 className="font-display text-[22px] font-bold text-[#0A0A0A] mb-2">Your application needs a fix</h1>
          <p className="text-[13.5px] text-[#52525B] mb-5 leading-relaxed">
            Admin noted something that needs to be corrected before approval. Once you resubmit, review usually takes under a day.
          </p>

          {brand.rejection_reason && (
            <div className="text-left bg-[#FDEEE9] border border-[#E8401A]/20 border-l-4 border-l-[#E8401A] rounded-[10px] p-3.5 mb-5 flex items-start gap-3">
              <div className="flex-shrink-0 w-[22px] h-[22px] rounded-full bg-[#E8401A] text-white font-display font-extrabold text-[13px] flex items-center justify-center mt-0.5">!</div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-[0.4px] text-[#B91C1C] mb-1">Reason from admin</div>
                <div className="text-[12.5px] text-[#0A0A0A] leading-relaxed">{brand.rejection_reason}</div>
              </div>
            </div>
          )}

          <button
            onClick={handleResubmit}
            disabled={submitting}
            className="w-full py-3.5 bg-[#FFC107] hover:bg-[#E0A800] text-[#0A0A0A] font-display font-bold rounded-[12px] text-sm disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {submitting ? 'Submitting…' : 'Update & resubmit'}
          </button>
          <button
            onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
            className="w-full mt-2 py-2.5 text-xs font-semibold text-[#52525B] hover:text-[#0A0A0A] transition"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
