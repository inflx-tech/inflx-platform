'use client';
import { useState } from 'react';
import { brandApi } from '../../lib/api';

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
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center border border-border shadow-lg">
        <div className="text-4xl mb-4">✅</div>
        <h1 className="font-display text-xl font-bold text-t1 mb-2">Resubmitted!</h1>
        <p className="text-sm text-t2">Your application has been resubmitted for review.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center border border-border shadow-lg">
        <div className="text-4xl mb-4">❌</div>
        <h1 className="font-display text-xl font-bold text-t1 mb-2">Application Rejected</h1>
        {brand.rejection_reason && (
          <div className="bg-red-pale border border-red/20 rounded-xl p-3 mb-4 text-xs text-red text-left">
            <strong>Reason:</strong> {brand.rejection_reason}
          </div>
        )}
        <p className="text-sm text-t2 mb-4">Please review the rejection reason and resubmit your application.</p>
        <button onClick={handleResubmit} disabled={submitting} className="w-full py-3 bg-gradient-to-r from-red to-orange text-white font-bold rounded-lg text-sm disabled:opacity-50">
          {submitting ? 'Submitting...' : 'Resubmit Application'}
        </button>
        <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }} className="mt-3 text-xs text-t3 hover:text-t2">Sign out</button>
      </div>
    </div>
  );
}
