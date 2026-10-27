import { useEffect, useState } from 'react';
import { brandApi, fmtMoney } from '../../../../lib/api';

/* Payout / escrow ledger as a hub section (features/brand-cc-sets-escrow, A4).
   Replaces the standalone /escrow route (which used a scoped `.esc` CSS outlier).
   Self-fetches the rich escrow shape (summary + influencer_breakdown), IG-clean. */

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const PILL = {
  queued:   'bg-[#DBEAFE] text-[#1D4ED8]',
  locked:   'bg-[#FFF7CC] text-[#6B5A00]',
  released: 'bg-[#D1FAE5] text-[#047857]',
};

export default function PayoutSection({ id, onOpenConversions }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let on = true;
    brandApi.getCampaignEscrow(id).then((res) => {
      if (!on) return;
      if (res.success) setData(res.data);
      else setError(res.error?.message || 'Failed to load payout data');
    }).catch(() => { if (on) setError('Failed to load payout data'); }).finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [id]);

  if (loading) return <div className="py-10 text-center text-[12px] text-[#71717A]">Loading payout…</div>;
  if (error) return <div className="py-10 text-center text-[12px] text-[#B91C1C]">{error}</div>;

  const summary = data?.summary;
  const breakdown = data?.influencer_breakdown || [];
  const hasTranches = data?.campaign?.has_tranches !== false;

  if (!hasTranches) {
    return (
      <div className="bg-white border border-[#E4E4E7] rounded-[14px] p-6">
        <div className="text-[14px] font-bold text-[#0A0A0A] mb-1.5">Commission-only campaign</div>
        <p className="text-[12.5px] text-[#52525B] leading-[1.6] max-w-[560px]">
          This campaign pays influencers <strong>commission per conversion</strong>, not a fixed fee — so there are no
          tranches to lock up front. Earnings appear in each influencer&apos;s pending balance as conversions happen and
          roll to their wallet after the 30-day return window.
        </p>
        {onOpenConversions && (
          <button type="button" onClick={onOpenConversions} className="mt-3 text-[12px] font-bold text-[#6B5A00]">Open Analytics / Conversions →</button>
        )}
      </div>
    );
  }

  if (!data?.entries || data.entries.length === 0) {
    return (
      <div className="bg-white border border-[#E4E4E7] rounded-[14px] p-8 text-center">
        <div className="text-[13.5px] font-bold text-[#0A0A0A] mb-1">No payouts yet</div>
        <div className="text-[12px] text-[#71717A]">Money is locked when you sign an agreement on the phone; it appears here then.</div>
      </div>
    );
  }

  return (
    <div>
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {[
            ['Total escrowed', summary.total, 'text-[#0A0A0A]'],
            ['Locked', summary.total_locked, 'text-[#6B5A00]'],
            ['Released', summary.total_released, 'text-[#047857]'],
            ['Queued', summary.total_queued, 'text-[#1D4ED8]'],
          ].map(([label, val, cls]) => (
            <div key={label} className="bg-white border border-[#E4E4E7] rounded-[12px] p-3">
              <div className={`font-mono font-bold text-[16px] ${cls}`}>{fmtMoney(val)}</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.4px] text-[#A1A1AA] mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {breakdown.map((inf) => (
          <div key={inf.campaign_influencer_id} className="bg-white border border-[#E4E4E7] rounded-[12px] p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-mono font-bold text-[12.5px] text-[#0A0A0A]">
                {inf.instagram_handle ? `@${inf.instagram_handle}` : inf.influencer_name}
              </div>
              <div className="text-[10px] font-bold text-[#A1A1AA]">{inf.tranches.length} tranche{inf.tranches.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="flex flex-col gap-1.5">
              {inf.tranches.map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-1.5 border-t border-[#F4F4F5]">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold text-[#0A0A0A]">Tranche {t.tranche_number}</div>
                    <div className="text-[10.5px] text-[#71717A]">
                      {(t.trigger_event || '').replace(/_/g, ' ')}{t.released_at ? ` · released ${fmtDate(t.released_at)}` : ''}
                    </div>
                    {Number(t.escrow_fee_amount) > 0 && (
                      <div className="text-[10px] text-[#A1A1AA]">Protection fee {fmtMoney(t.escrow_fee_amount)} · GST {fmtMoney(t.fee_gst_amount)}</div>
                    )}
                  </div>
                  <div className="font-mono font-bold text-[12.5px] text-[#0A0A0A]">{fmtMoney(t.amount)}</div>
                  <span className={`text-[9.5px] font-bold uppercase tracking-[0.3px] px-2 py-1 rounded-[6px] ${PILL[t.status] || 'bg-[#F4F4F5] text-[#52525B]'}`}>{t.status}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
