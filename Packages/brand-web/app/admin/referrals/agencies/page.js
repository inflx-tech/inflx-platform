'use client';

import { useEffect, useState } from 'react';
import { referralApi, getStoredUser } from '../../../../lib/api';

const FILTERS = [
  { key: 'pending', label: 'Pending' },
  { key: '', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];
const STATUS_BADGE = {
  pending:   'bg-gold-pale text-yellow-700',
  approved:  'bg-teal-deep text-white',
  rejected:  'bg-red-pale text-red',
  suspended: 'bg-surface2 text-t3',
};
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

export default function AgenciesPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);

  const user = typeof window !== 'undefined' ? getStoredUser() : null;
  const canReview = ['reviewer', 'superadmin'].includes(user?.admin_role);

  async function load() {
    setLoading(true);
    const res = await referralApi.listAgencies({ status, search });
    setLoading(false);
    if (res.success) { setRows(res.data.agencies || []); setTotal(res.meta?.total || 0); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  async function approve(a) {
    setBusyId(a.id);
    const res = await referralApi.updateAgencyStatus(a.id, { status: 'approved' });
    setBusyId(null);
    if (res.success) load(); else alert(res.error?.message || 'Approve failed.');
  }
  async function reject(a) {
    const reason = window.prompt(`Reject ${a.agency_name}? Enter a reason (the agency is notified):`);
    if (reason === null) return;
    if (!reason.trim()) { alert('A reason is required to reject.'); return; }
    setBusyId(a.id);
    const res = await referralApi.updateAgencyStatus(a.id, { status: 'rejected', reason: reason.trim() });
    setBusyId(null);
    if (res.success) load(); else alert(res.error?.message || 'Reject failed.');
  }

  const isSuper = user?.admin_role === 'superadmin';

  return (
    <div className="space-y-3 max-w-5xl mx-auto">
      {/* D-2/D-3 intake — applications + generate code */}
      <ApplicationsPanel canDecide={isSuper} />
      <GenerateCodePanel canGenerate={isSuper} />

      <div className="bg-white rounded-xl border border-border p-4">
        <h1 className="font-display text-lg font-bold text-t1 mb-1">🏛️ Partner Agencies</h1>
        <p className="text-xs text-t3">Approve partner agencies and track what each has earned. Approved agencies can share their code and withdraw.</p>
        <div className="flex gap-2 mt-3 flex-wrap items-center">
          {FILTERS.map(f => (
            <button key={f.label} onClick={() => setStatus(f.key)}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border ${status === f.key ? 'bg-navy-deep text-white border-navy-deep' : 'bg-white text-t2 border-border'}`}>
              {f.label}
            </button>
          ))}
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="Search agency name… (Enter)"
            className="flex-1 min-w-[180px] border border-border rounded-lg px-3 py-1.5 text-xs" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border p-4 overflow-x-auto">
        {loading ? (
          <div className="text-t3 text-sm p-6 text-center">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-8 text-center text-t3">
            <div className="text-3xl">🏛️</div>
            <div className="mt-1.5 font-semibold text-t2">No agencies here</div>
            <div className="text-[11px] mt-0.5">Agencies appear once they sign up in the partner app.</div>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wider text-t3 bg-surface2">
                <th className="text-left p-2">Agency</th><th className="text-left p-2">City</th>
                <th className="text-left p-2">Status</th><th className="text-left p-2">Code</th>
                <th className="text-right p-2">Wallet</th><th className="text-right p-2">Earned</th>
                <th className="text-right p-2">Active refs</th><th className="text-left p-2">Joined</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(a => (
                <tr key={a.id} className="border-t border-border hover:bg-surface2/50 text-xs">
                  <td className="p-2 font-bold">{a.agency_name}
                    <div className="font-medium text-t3 text-[10.5px]">{[a.contact_person, a.contact_email].filter(Boolean).join(' · ') || '—'}</div>
                  </td>
                  <td className="p-2">{a.city || '—'}</td>
                  <td className="p-2"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_BADGE[a.user_status] || 'bg-surface2 text-t3'}`}>{a.user_status}</span></td>
                  <td className="p-2">{a.referral_code ? <span className="font-mono text-[11px] bg-surface2 border border-border rounded px-1.5 py-0.5">{a.referral_code}</span> : <span className="text-t3">—</span>}</td>
                  <td className="p-2 text-right tabular-nums font-bold">{a.user_status === 'approved' ? inr(a.wallet_balance) : <span className="text-t3">—</span>}</td>
                  <td className="p-2 text-right tabular-nums font-bold">{a.user_status === 'approved' ? inr(a.referral_earned_total) : <span className="text-t3">—</span>}</td>
                  <td className="p-2 text-right tabular-nums">{a.user_status === 'approved' ? a.active_edges : <span className="text-t3">—</span>}</td>
                  <td className="p-2">{fmtDate(a.created_at)}</td>
                  <td className="p-2">
                    {canReview && a.user_status === 'pending' && (
                      <div className="flex gap-1.5 justify-end">
                        <button disabled={busyId === a.id} onClick={() => approve(a)} className="text-[11px] px-2.5 py-1 rounded-md bg-teal-deep text-white font-bold disabled:opacity-50">Approve</button>
                        <button disabled={busyId === a.id} onClick={() => reject(a)} className="text-[11px] px-2.5 py-1 rounded-md border border-red/30 text-red font-bold disabled:opacity-50">Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && rows.length > 0 && <p className="text-[11px] text-t3 mt-2">{total} agenc{total === 1 ? 'y' : 'ies'}</p>}
      </div>

      {!canReview && (
        <div className="text-[11px] text-t2 bg-white border border-dashed border-border rounded-lg px-3.5 py-2.5">
          You can view agencies. <b>Reviewer / superadmin</b> can approve or reject.
        </div>
      )}
    </div>
  );
}

// ── D-2 — apply-to-become-referrer applications ─────────────────────────────
const APP_FILTERS = [
  { key: 'requested', label: 'Pending' },
  { key: '', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];
const APP_STATUS_BADGE = {
  requested: 'bg-gold-pale text-yellow-700',
  approved:  'bg-teal-deep text-white',
  rejected:  'bg-red-pale text-red',
};

function ApplicationsPanel({ canDecide }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('requested');
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    const res = await referralApi.adminListReferralApplications({ status });
    setLoading(false);
    if (res.success) { setRows(res.data || []); setTotal(res.meta?.total || 0); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  async function decide(a, action) {
    let note = null;
    if (action === 'reject') {
      const reason = window.prompt(`Reject ${a.applicant_name}? Enter a reason (optional):`);
      if (reason === null) return;
      note = reason.trim() || null;
    }
    setBusyId(a.id);
    const res = await referralApi.adminDecideReferralApplication(a.id, { action, note });
    setBusyId(null);
    if (res.success) {
      if (action === 'approve' && res.data?.allocated_code) {
        alert(`Approved. Allocated code: ${res.data.allocated_code}`);
      }
      load();
    } else {
      alert(res.error?.message || 'Decision failed.');
    }
  }

  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <h2 className="font-display text-base font-bold text-t1 mb-1">📨 Referrer Applications</h2>
      <p className="text-xs text-t3">Influencers applying to become referrers. Approving generates and allocates their shareable code.</p>
      <div className="flex gap-2 mt-3 flex-wrap items-center">
        {APP_FILTERS.map(f => (
          <button key={f.label} onClick={() => setStatus(f.key)}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border ${status === f.key ? 'bg-navy-deep text-white border-navy-deep' : 'bg-white text-t2 border-border'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-3 overflow-x-auto">
        {loading ? (
          <div className="text-t3 text-sm p-4 text-center">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-6 text-center text-t3 text-[11px]">No applications here.</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wider text-t3 bg-surface2">
                <th className="text-left p-2">Applicant</th><th className="text-left p-2">Status</th>
                <th className="text-left p-2">Note</th><th className="text-left p-2">Code</th>
                <th className="text-left p-2">Applied</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(a => (
                <tr key={a.id} className="border-t border-border hover:bg-surface2/50 text-xs">
                  <td className="p-2 font-bold">{a.applicant_name}
                    <span className="ml-1.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-teal-pale text-teal-deep">{a.applicant_type}</span>
                  </td>
                  <td className="p-2"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${APP_STATUS_BADGE[a.status] || 'bg-surface2 text-t3'}`}>{a.status}</span></td>
                  <td className="p-2 text-t2 max-w-[180px] truncate">{a.note || '—'}</td>
                  <td className="p-2">{a.allocated_code ? <span className="font-mono text-[11px] bg-surface2 border border-border rounded px-1.5 py-0.5">{a.allocated_code}</span> : <span className="text-t3">—</span>}</td>
                  <td className="p-2">{fmtDate(a.created_at)}</td>
                  <td className="p-2">
                    {canDecide && a.status === 'requested' && (
                      <div className="flex gap-1.5 justify-end">
                        <button disabled={busyId === a.id} onClick={() => decide(a, 'approve')} className="text-[11px] px-2.5 py-1 rounded-md bg-teal-deep text-white font-bold disabled:opacity-50">Approve</button>
                        <button disabled={busyId === a.id} onClick={() => decide(a, 'reject')} className="text-[11px] px-2.5 py-1 rounded-md border border-red/30 text-red font-bold disabled:opacity-50">Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && rows.length > 0 && <p className="text-[11px] text-t3 mt-2">{total} application{total === 1 ? '' : 's'}</p>}
      </div>
    </div>
  );
}

// ── D-3 — admin generate/allocate a referral code ───────────────────────────
function GenerateCodePanel({ canGenerate }) {
  const [referrerType, setReferrerType] = useState('influencer');
  const [referrerId, setReferrerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  if (!canGenerate) return null;

  async function submit() {
    setErr(''); setResult(null); setBusy(true);
    const res = await referralApi.adminGenerateReferralCode({ referrer_type: referrerType, referrer_id: referrerId.trim() });
    setBusy(false);
    if (res.success) setResult(res.data);
    else setErr(res.error?.message || 'Could not generate code.');
  }

  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <h2 className="font-display text-base font-bold text-t1 mb-1">🎟️ Generate code</h2>
      <p className="text-xs text-t3">Directly ensure/return a referral code for an influencer or agency by ID.</p>
      <div className="flex gap-2.5 mt-3 flex-wrap items-end">
        <select value={referrerType} onChange={e => setReferrerType(e.target.value)} className="border-[1.5px] border-border rounded-lg px-3 py-2 text-xs">
          <option value="influencer">Influencer</option>
          <option value="agency">Agency</option>
        </select>
        <input value={referrerId} onChange={e => setReferrerId(e.target.value)} placeholder="referrer ID"
          className="flex-1 min-w-[200px] border-[1.5px] border-border rounded-lg px-3 py-2 text-xs" />
        <button onClick={submit} disabled={busy || !referrerId.trim()} className="bg-gold text-yellow-900 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50">
          {busy ? 'Working…' : 'Generate'}
        </button>
      </div>
      {result && (
        <div className="text-[11px] text-t2 bg-surface2 rounded-lg px-3 py-2 mt-2">
          Code: <span className="font-mono bg-white border border-border rounded px-1.5 py-0.5">{result.code}</span>
        </div>
      )}
      {err && <div className="text-[11px] text-red font-semibold mt-2">⚠ {err}</div>}
    </div>
  );
}
