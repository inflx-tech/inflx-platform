'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { contractApi, walletApi, fmtRupees } from '../../../lib/api';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function platformFee(c) {
  return parseFloat(c.platform_fee_pct || 8);
}
function lockAmount(c) {
  const base  = parseFloat(c.influencer_fee || 0);
  const bonus = parseFloat(c.bonus_amount || 0);
  const fee   = platformFee(c);
  return parseFloat(((base + bonus) * (1 + fee / 100)).toFixed(2));
}

export default function ContractsInboxPage() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(() => new Set());
  const [signing, setSigning]     = useState(false);
  const [error, setError]         = useState('');
  const [okMsg, setOkMsg]         = useState('');
  const [wallet, setWallet]       = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    const [cRes, wRes] = await Promise.all([
      contractApi.listPending(),
      walletApi.getBalance().catch(() => null),
    ]);
    setLoading(false);
    if (!cRes.success) {
      setError(cRes.error?.message || 'Failed to load contracts');
      return;
    }
    setContracts(cRes.data?.contracts || []);
    if (wRes?.success) setWallet(wRes.data?.wallet || wRes.data);
  }

  useEffect(() => { load(); }, []);

  const totalLock = useMemo(
    () => contracts
      .filter(c => selected.has(c.id))
      .reduce((sum, c) => sum + lockAmount(c), 0),
    [contracts, selected]
  );

  const walletBalance = parseFloat(wallet?.wallet_balance ?? 0);
  const walletShort   = totalLock > walletBalance;

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (selected.size === contracts.length) setSelected(new Set());
    else setSelected(new Set(contracts.map(c => c.id)));
  }

  async function signSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`Counter-sign ${ids.length} contract${ids.length !== 1 ? 's' : ''} for a total wallet lock of ${fmtRupees(totalLock)}?`)) return;
    setSigning(true);
    setError(''); setOkMsg('');
    const res = await contractApi.bulkSign(ids);
    setSigning(false);
    if (!res.success) {
      setError(res.error?.message || 'Bulk sign failed');
      return;
    }
    setOkMsg(`Signed ${res.data?.signed_count || ids.length} contract${(res.data?.signed_count || ids.length) !== 1 ? 's' : ''}.`);
    setSelected(new Set());
    load();
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-lg font-bold text-t1">Contracts — pending your signature</h1>
          <p className="text-xs text-t3">Influencers have signed; counter-sign to lock funds and start the campaign.</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 bg-surface2 text-t2 text-xs font-semibold rounded-lg hover:bg-navy-pale">
          Refresh
        </button>
      </div>

      {error && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">{error}</div>}
      {okMsg && <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">{okMsg}</div>}

      {loading ? (
        <div className="p-8 text-center text-t3 text-sm">Loading…</div>
      ) : contracts.length === 0 ? (
        <div className="p-8 bg-white border border-border rounded-2xl text-center">
          <div className="text-sm font-semibold text-t1">No contracts waiting on you.</div>
          <div className="text-xs text-t3 mt-1">When an influencer signs a contract, it'll show up here for your counter-signature.</div>
        </div>
      ) : (
        <>
          {/* Bulk action bar */}
          <div className={`sticky top-0 z-10 bg-white border border-border rounded-xl p-3 mb-3 flex items-center justify-between gap-3 ${selected.size > 0 ? 'shadow-md' : ''}`}>
            <label className="flex items-center gap-2 text-xs font-semibold text-t2 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.size === contracts.length && contracts.length > 0}
                onChange={toggleAll}
                className="w-4 h-4 rounded border-border2"
              />
              {selected.size === 0
                ? `Select all (${contracts.length})`
                : `${selected.size} selected · lock total ${fmtRupees(totalLock)}`}
            </label>
            <div className="flex items-center gap-2">
              {selected.size > 0 && (
                <span className={`text-[11px] font-semibold ${walletShort ? 'text-red-600' : 'text-t3'}`}>
                  {wallet
                    ? walletShort
                      ? `Wallet ${fmtRupees(walletBalance)} — short ${fmtRupees(totalLock - walletBalance)}`
                      : `Wallet ${fmtRupees(walletBalance)}`
                    : ''}
                </span>
              )}
              <button
                onClick={signSelected}
                disabled={selected.size === 0 || signing || walletShort}
                className="px-4 py-2 bg-navy text-white text-xs font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-navy-dark"
              >
                {signing ? 'Signing…' : `Sign selected${selected.size > 0 ? ` (${selected.size})` : ''}`}
              </button>
            </div>
          </div>

          {/* Contracts list */}
          <div className="space-y-2">
            {contracts.map(c => {
              const lock = lockAmount(c);
              const base = parseFloat(c.influencer_fee || 0);
              const bonus = parseFloat(c.bonus_amount || 0);
              const isSel = selected.has(c.id);
              return (
                <div
                  key={c.id}
                  className={`bg-white rounded-xl border p-3 flex items-center gap-3 transition-all ${isSel ? 'border-navy ring-2 ring-navy/20' : 'border-border hover:border-navy/30'}`}
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggle(c.id)}
                    className="w-4 h-4 rounded border-border2 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-sm text-t1 truncate">@{c.instagram_handle || '—'}</span>
                      <span className="text-[10px] text-t3 uppercase font-bold">{c.goal || 'engagement'}</span>
                    </div>
                    <div className="text-[11px] text-t3 truncate">
                      {c.campaign_name} · signed {fmtDate(c.influencer_signed_at)}
                      {c.production_mode ? ` · ${c.production_mode}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-t3">Lock</div>
                    <div className="text-sm font-bold text-t1">{fmtRupees(lock)}</div>
                    {bonus > 0 && (
                      <div className="text-[10px] text-t3">{fmtRupees(base)} + {fmtRupees(bonus)} bonus</div>
                    )}
                  </div>
                  <Link
                    href={`/dashboard/campaigns/${c.campaign_id}`}
                    className="text-[11px] font-semibold text-navy hover:underline shrink-0"
                  >
                    Review →
                  </Link>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
