'use client';
export default function WaitingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center border border-border shadow-lg">
        <div className="text-4xl mb-4">⏳</div>
        <h1 className="font-display text-xl font-bold text-t1 mb-2">Application Under Review</h1>
        <p className="text-sm text-t2 mb-4 leading-relaxed">Your brand application is being reviewed by the INFLX team. You'll receive an SMS when approved (usually within 24 hours).</p>
        <div className="bg-navy-pale rounded-xl p-3 text-xs text-navy font-medium">
          Dev tip: Use admin dashboard at <strong>localhost:3003</strong> to approve this account
        </div>
        <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }} className="mt-4 text-xs text-t3 hover:text-t2">Sign out</button>
      </div>
    </div>
  );
}
