'use client';

import { useEffect, useState } from 'react';
import { referralApi, getStoredUser } from '../../../../lib/api';

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'ended', label: 'Ended' },
  { key: 'expired', label: 'Expired' },
];

const TYPE_TAG = {
  agency: 'bg-violet-100 text-violet-700',
  influencer: 'bg-teal-pale text-teal-deep',
  brand: 'bg-gold-pale text-yellow-700',
};
const STATUS_BADGE = {
  active: 'bg-teal-deep text-white',
  ended: 'bg-surface2 text-t3',
  expired: 'bg-red-pale text-red',
};

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'; }

export default function ReferralRelationshipsPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const user = typeof window !== 'undefined' ? getStoredUser() : null;
  const isSuper = user?.admin_role === 'superadmin';

  async function load() {
    setLoading(true);
    const res = await referralApi.listEdges({ status, search });
    setLoading(false);
    if (res.success) { setRows(res.data); setTotal(res.meta?.total || 0); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  async function editPct(row) {
    const next = window.prompt(`New referral % for ${row.referrer_name} → ${row.referred_name}`, String(row.pct));
    if (next === null) return;
    const pct = parseFloat(next);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) { alert('Enter a number 0–100.'); return; }
    const res = await referralApi.updateEdge(row.id, { pct });
    if (res.success) load(); else alert(res.error?.message || 'Update failed.');
  }
  async function endEdge(row) {
    if (!window.confirm(`End this referral? ${row.referrer_name} stops earning on ${row.referred_name}. The entity can then get a new referrer.`)) return;
    const res = await referralApi.updateEdge(row.id, { status: 'ended' });
    if (res.success) load(); else alert(res.error?.message || 'Could not end.');
  }

  return (
    <div className="space-y-3 max-w-5xl mx-auto">
      <div className="bg-white rounded-xl border border-border p-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="font-display text-lg font-bold text-t1 mb-1">🤝 Referral Relationships</h1>
            <p className="text-xs text-t3">Every active and past referral link. One active referrer per referred entity (first-touch, locked).</p>
          </div>
          {isSuper && (
            <button onClick={() => setShowCreate(true)} className="bg-gold text-yellow-900 rounded-lg px-4 py-2 text-xs font-bold">+ Create link</button>
          )}
        </div>
        <div className="flex gap-2 mt-3 flex-wrap items-center">
          {STATUS_FILTERS.map(f => (
            <button key={f.key} onClick={() => setStatus(f.key)}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border ${status === f.key ? 'bg-navy-deep text-white border-navy-deep' : 'bg-white text-t2 border-border'}`}>
              {f.label}
            </button>
          ))}
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="Search referrer or referred… (Enter)"
            className="flex-1 min-w-[180px] border border-border rounded-lg px-3 py-1.5 text-xs" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border p-4 overflow-x-auto">
        {loading ? (
          <div className="text-t3 text-sm p-6 text-center">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-t3 text-sm p-8 text-center">No referral links yet.{isSuper ? ' Use “Create link” to add one.' : ''}</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wider text-t3 bg-surface2">
                <th className="text-left p-2">Referrer</th><th></th><th className="text-left p-2">Referred</th>
                <th className="text-right p-2">%</th><th className="text-left p-2">Started</th><th className="text-left p-2">Expires</th>
                <th className="text-left p-2">Status</th><th className="text-left p-2">Source</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-surface2/50 text-xs">
                  <td className="p-2 font-bold">{r.referrer_name}<span className={`ml-1.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${TYPE_TAG[r.referrer_type]}`}>{r.referrer_type}</span></td>
                  <td className="text-t3 font-bold">→</td>
                  <td className="p-2 font-bold">{r.referred_name}<span className={`ml-1.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${TYPE_TAG[r.referred_type]}`}>{r.referred_type}</span></td>
                  <td className="p-2 text-right font-extrabold tabular-nums">{Number(r.pct).toFixed(2)}</td>
                  <td className="p-2">{fmtDate(r.started_at)}</td>
                  <td className="p-2">{fmtDate(r.expires_at)}</td>
                  <td className="p-2"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_BADGE[r.status]}`}>{r.status}</span></td>
                  <td className="p-2 text-[10px] text-t3">{r.source}</td>
                  <td className="p-2">
                    {isSuper && r.status === 'active' && (
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => editPct(r)} className="text-[11px] px-2.5 py-1 rounded-md border border-border text-t2">Edit %</button>
                        <button onClick={() => endEdge(r)} className="text-[11px] px-2.5 py-1 rounded-md border border-red/30 text-red">End</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && rows.length > 0 && <p className="text-[11px] text-t3 mt-2">{total} link{total === 1 ? '' : 's'}</p>}
      </div>

      {showCreate && isSuper && <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CreateModal({ onClose, onCreated }) {
  const [referrerType, setReferrerType] = useState('influencer');
  const [referrerId, setReferrerId] = useState('');
  const [referredType, setReferredType] = useState('brand');
  const [referredId, setReferredId] = useState('');
  const [pct, setPct] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setErr(''); setBusy(true);
    const body = { referrer_type: referrerType, referrer_id: referrerId.trim(), referred_type: referredType, referred_id: referredId.trim() };
    if (pct !== '') body.pct = parseFloat(pct);
    const res = await referralApi.createEdge(body);
    setBusy(false);
    if (res.success) onCreated();
    else setErr(res.error?.message || 'Could not create link.');
  }

  return (
    <div className="fixed inset-0 bg-navy-deep/45 flex items-start justify-center pt-16 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl w-[460px] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border font-display font-bold text-sm">Create referral link</div>
        <div className="p-5 space-y-3.5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1.5">Referrer</div>
            <div className="flex gap-2.5">
              <select value={referrerType} onChange={e => setReferrerType(e.target.value)} className="flex-1 border-[1.5px] border-border rounded-lg px-3 py-2 text-xs">
                <option value="influencer">Influencer</option>
                <option value="agency">Agency (after Contract 3)</option>
              </select>
              <input value={referrerId} onChange={e => setReferrerId(e.target.value)} placeholder="referrer ID" className="flex-1 border-[1.5px] border-border rounded-lg px-3 py-2 text-xs" />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1.5">Referred</div>
            <div className="flex gap-2.5">
              <select value={referredType} onChange={e => setReferredType(e.target.value)} className="flex-1 border-[1.5px] border-border rounded-lg px-3 py-2 text-xs">
                <option value="brand">Brand</option>
                <option value="influencer">Influencer</option>
              </select>
              <input value={referredId} onChange={e => setReferredId(e.target.value)} placeholder="referred ID" className="flex-1 border-[1.5px] border-border rounded-lg px-3 py-2 text-xs" />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-1.5">Commission %</div>
            <input value={pct} onChange={e => setPct(e.target.value)} placeholder="defaults to the global default %" className="w-full border-[1.5px] border-border rounded-lg px-3 py-2 text-xs" />
          </div>
          <div className="text-[11px] text-t2 bg-surface2 rounded-lg px-3 py-2">
            Earns for <b>12 months</b> from today. Brand referred → % of subscription + protection fee. Influencer referred → % of public-purchase commission. IDs come from the Brands / Influencers pages.
          </div>
          {err && <div className="text-[11px] text-red font-semibold">⚠ {err}</div>}
        </div>
        <div className="px-5 py-3.5 border-t border-border flex justify-end gap-2 bg-surface2">
          <button onClick={onClose} className="bg-white border border-border text-t2 rounded-lg px-4 py-2 text-xs font-bold">Cancel</button>
          <button onClick={submit} disabled={busy || !referrerId.trim() || !referredId.trim()} className="bg-gold text-yellow-900 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50">
            {busy ? 'Creating…' : 'Create link'}
          </button>
        </div>
      </div>
    </div>
  );
}
