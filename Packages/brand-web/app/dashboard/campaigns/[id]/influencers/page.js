'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  campaignApi, brandApi, negotiationApi, contractApi, productionApi, applicationApi,
  fmtRupees,
} from '../../../../../lib/api';
import { walletLock } from '../../../../../lib/contracts';

/* ─── Helpers / palette ──────────────────────────────────────────────────── */

const STATUS_BADGE = {
  invited:     { bg: 'bg-[#F4F4F5]', text: 'text-[#52525B]', dot: 'bg-[#A1A1AA]', label: 'Invited' },
  applied:     { bg: 'bg-[#FFF7CC]', text: 'text-[#6B5A00]', dot: 'bg-[#FFC107]', label: 'Applied' },
  accepted:    { bg: 'bg-[#D1FAE5]', text: 'text-[#047857]', dot: 'bg-[#10B981]', label: 'Accepted' },
  negotiating: { bg: 'bg-[#FFF7CC]', text: 'text-[#6B5A00]', dot: 'bg-[#E0A800]', label: 'Negotiating' },
  contracted:  { bg: 'bg-[#D1FAE5]', text: 'text-[#047857]', dot: 'bg-[#10B981]', label: 'Contracted' },
  active:      { bg: 'bg-[#D1FAE5]', text: 'text-[#047857]', dot: 'bg-[#10B981]', label: 'Active' },
  live:        { bg: 'bg-[#D1FAE5]', text: 'text-[#047857]', dot: 'bg-[#10B981]', label: 'Live' },
  completed:   { bg: 'bg-[#F4F4F5]', text: 'text-[#1F1F22]', dot: 'bg-[#71717A]', label: 'Completed' },
  declined:    { bg: 'bg-[#FDEEE9]', text: 'text-[#B91C1C]', dot: 'bg-[#E8401A]', label: 'Declined' },
  expired:     { bg: 'bg-[#F4F4F5]', text: 'text-[#52525B]', dot: 'bg-[#A1A1AA]', label: 'Expired' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_BADGE[status] || { bg: 'bg-[#F4F4F5]', text: 'text-[#52525B]', dot: 'bg-[#A1A1AA]', label: (status || '').replace(/_/g, ' ') };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.3px] ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function TrancheDot({ status }) {
  if (status === 'released') return <span className="text-[#047857] text-sm leading-none">●</span>;
  if (status === 'locked')   return <span className="text-[#0A0A0A] text-sm leading-none">●</span>;
  if (status === 'queued')   return <span className="text-[#E0A800] text-sm leading-none">●</span>;
  return <span className="text-[#D4D4D8] text-sm leading-none">○</span>;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtSlot(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STANDARD_CLAUSES_WEB = [
  {
    id: 'commercial_rights',
    label: 'Commercial Usage Rights',
    description: 'Brand may repurpose your content in paid ads / social / offline marketing.',
    options: [30, 60, 90, 180, 365],
    optionLabel: 'days',
  },
  {
    id: 'category_exclusivity',
    label: 'Category Exclusivity',
    description: "Influencer won't promote competing brands in same category.",
    options: [7, 14, 30],
    optionLabel: 'days',
  },
  {
    id: 'content_ownership',
    label: 'Content Ownership Transfer',
    description: 'Brand owns final approved content; influencer keeps it on their profile.',
    options: [],
  },
];

/* ─── Negotiation modal ──────────────────────────────────────────────────── */

function NegotiationModal({ inf, negotiation, loading, onClose, onRespond }) {
  const [counterFee, setCounterFee] = useState('');
  const [note, setNote] = useState('');
  const turns = negotiation?.turns || [];
  const lastTurn = turns[turns.length - 1];
  const isMyTurn = negotiation?.next_turn === 'brand';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 font-body" onClick={onClose}>
      <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[#F4F4F5] flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-[#0A0A0A]">Negotiation</h2>
            <p className="text-[11px] text-[#71717A] mt-0.5 font-mono">@{inf.instagram_handle}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F4F4F5] text-[#71717A]">✕</button>
        </div>

        <div className="p-5 space-y-3 max-h-64 overflow-y-auto">
          {turns.length === 0 ? (
            <p className="text-[11px] text-[#71717A] text-center py-4">No turns yet</p>
          ) : turns.map((t, i) => {
            const isBrand = t.by_role === 'brand';
            return (
              <div key={i} className={`flex ${isBrand ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs rounded-[14px] px-3 py-2 text-[12px] ${isBrand ? 'bg-[#0A0A0A] text-white' : 'bg-[#F4F4F5] text-[#1F1F22]'}`}>
                  <div className="font-bold mb-0.5">{isBrand ? 'You' : `@${inf.instagram_handle}`}</div>
                  <div className="font-mono font-bold text-sm">₹{parseFloat(t.proposed_fee || 0).toFixed(0)}</div>
                  {t.note && <div className="mt-1 opacity-80">{t.note}</div>}
                  <div className="text-[9.5px] opacity-70 mt-1 capitalize">{t.action}</div>
                </div>
              </div>
            );
          })}
        </div>

        {isMyTurn ? (
          <div className="p-5 border-t border-[#F4F4F5] space-y-3">
            <p className="text-[11px] font-bold text-[#52525B] uppercase tracking-[0.3px]">Your turn to respond</p>
            {lastTurn && (
              <div className="bg-[#FFF7CC] border border-[#FFC107]/40 rounded-[10px] px-3 py-2 text-[11.5px] text-[#6B5A00]">
                Influencer proposes <strong className="font-mono">₹{parseFloat(lastTurn.proposed_fee || 0).toFixed(0)}</strong>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => onRespond('accept', lastTurn?.proposed_fee, '')}
                disabled={loading}
                className="flex-1 py-2.5 bg-[#0A0A0A] text-[#FFC107] font-bold text-[12px] rounded-[10px] hover:bg-[#1F1F22] disabled:opacity-50 transition-colors">
                Accept ₹{parseFloat(lastTurn?.proposed_fee || 0).toFixed(0)}
              </button>
              <button onClick={() => onRespond('decline', 0, '')}
                disabled={loading}
                className="flex-1 py-2.5 bg-[#FDEEE9] text-[#B91C1C] font-bold text-[12px] rounded-[10px] hover:bg-[#FBCBC4] disabled:opacity-50 transition-colors">
                Decline
              </button>
            </div>
            <div className="text-[11px] text-[#71717A] font-semibold text-center">— or counter —</div>
            <div className="flex items-center border border-[#E4E4E7] rounded-[10px] overflow-hidden focus-within:border-[#FFC107] focus-within:ring-2 focus-within:ring-[#FFF7CC]">
              <span className="px-3 py-2.5 text-sm font-bold text-[#71717A] bg-[#FAFAFA] font-mono">₹</span>
              <input value={counterFee} onChange={e => setCounterFee(e.target.value)} type="number"
                placeholder="Your counter fee" className="flex-1 py-2.5 px-2 text-[13px] outline-none bg-white font-mono" />
            </div>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
              className="w-full border border-[#E4E4E7] rounded-[10px] px-3 py-2.5 text-[12px] outline-none focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFF7CC]" />
            <button onClick={() => onRespond('counter', parseFloat(counterFee || '0'), note)}
              disabled={loading || !counterFee}
              className="w-full py-2.5 bg-[#FFC107] text-[#0A0A0A] font-bold text-[12px] rounded-[10px] hover:bg-[#E0A800] disabled:opacity-50 transition-colors">
              Send counter offer
            </button>
          </div>
        ) : (
          <div className="p-5 border-t border-[#F4F4F5]">
            <p className="text-[11.5px] text-center text-[#71717A]">Waiting for influencer to respond…</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Production panel (nested inside ContractModal for active contracts) ──── */

function ProductionPanel({ contractId }) {
  const [event, setEvent]       = useState(null);
  const [mode, setMode]         = useState(null);
  const [log, setLog]           = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);
  const [dateRange, setDateRange] = useState(null);

  const [vAddress, setVAddress]           = useState('');
  const [vCity, setVCity]                 = useState('');
  const [vPincode, setVPincode]           = useState('');
  const [vWindow, setVWindow]             = useState(60);
  const [vContactName, setVContactName]   = useState('');
  const [vContactPhone, setVContactPhone] = useState('');

  const [cScheduledAt, setCScheduledAt]   = useState('');
  const [showCounter, setShowCounter]     = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [res, rangeRes] = await Promise.all([
      productionApi.get(contractId),
      productionApi.getDateRange(contractId).catch(() => null),
    ]);
    setLoading(false);
    if (res.success) {
      setEvent(res.data?.production_event || null);
      setMode(res.data?.production_mode || null);
      setLog(res.data?.log || []);
      const e = res.data?.production_event;
      if (e) {
        setVAddress(e.visit_address || '');
        setVCity(e.visit_city || '');
        setVPincode(e.visit_pincode || '');
        setVWindow(e.visit_window_minutes || 60);
        setVContactName(e.visit_contact_name || '');
        setVContactPhone(e.visit_contact_phone || '');
      }
    }
    if (rangeRes?.success) setDateRange(rangeRes.data?.range || null);
  }, [contractId]);

  useEffect(() => { load(); }, [load]);

  const dateHint = dateRange
    ? `Visit must be between ${new Date(dateRange.earliest).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} and ${new Date(dateRange.latest).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : null;

  async function saveLocationOnly() {
    setSaving(true); setError(null);
    const res = await productionApi.setVisitDetails(contractId, {
      visit_address: vAddress.trim(),
      visit_city:    vCity.trim() || null,
      visit_pincode: vPincode.trim() || null,
      visit_window_minutes: Number(vWindow) || null,
      visit_contact_name:   vContactName.trim() || null,
      visit_contact_phone:  vContactPhone.trim() || null,
    });
    setSaving(false);
    if (res.success) load();
    else setError(res.error?.message || 'Save failed');
  }

  async function acceptSlot() {
    setSaving(true); setError(null);
    const res = await productionApi.accept(event.id);
    setSaving(false);
    if (res.success) load();
    else setError(res.error?.message || 'Could not accept slot');
  }

  async function sendCounter() {
    if (!cScheduledAt) { setError('Pick a date/time'); return; }
    setSaving(true); setError(null);
    const res = await productionApi.counterPropose(event.id, {
      visit_scheduled_at:   new Date(cScheduledAt).toISOString(),
      visit_window_minutes: Number(vWindow) || null,
    });
    setSaving(false);
    if (res.success) { setShowCounter(false); setCScheduledAt(''); load(); }
    else setError(res.error?.message || 'Counter failed');
  }

  async function sendReschedule() {
    if (!cScheduledAt) { setError('Pick a date/time'); return; }
    setSaving(true); setError(null);
    const res = await productionApi.setVisitDetails(contractId, {
      visit_scheduled_at:   new Date(cScheduledAt).toISOString(),
      visit_window_minutes: Number(vWindow) || null,
    });
    setSaving(false);
    if (res.success) { setShowReschedule(false); setCScheduledAt(''); load(); }
    else setError(res.error?.message || 'Reschedule failed');
  }

  async function flipToRemote() {
    if (!event) return;
    if (!confirm('Switch to remote production? No in-person shoot. The other side has to confirm before it takes effect.')) return;
    setSaving(true); setError(null);
    const res = await productionApi.flipToRemote(event.id);
    setSaving(false);
    if (res.success) load();
    else setError(res.error?.message || 'Flip failed');
  }

  // Item 12 (approval Q3): "Mark visit done" is retired server-side for a Store Visit too; the
  // visit is marked and confirmed in the app. The website shows the read-only card below.

  if (loading) return <div className="p-5 border-t border-[#F4F4F5] text-[11px] text-[#71717A]">Loading production…</div>;

  if (mode === 'remote') {
    return (
      <div className="p-5 border-t border-[#F4F4F5]">
        <div className="bg-[#FAFAFA] border border-[#E4E4E7] rounded-[12px] p-3 text-[11.5px] text-[#52525B] text-center">
          Remote — nothing is sent and there is no time to agree. The creator marks the shoot done in the app when she has shot it.
        </div>
      </div>
    );
  }

  // Item 10 (approval Q12): the mode of work comes from the set and nobody picks it here any more.
  // The row is created at the brand's signature; a missing row means the read door will heal it.
  if (!event) {
    return (
      <div className="p-5 border-t border-[#F4F4F5]">
        <div className="bg-[#FAFAFA] border border-[#E4E4E7] rounded-[12px] p-3 text-[11.5px] text-[#52525B] text-center">
          The shoot plan is managed in the app. It opens once the agreement is signed by both and, where there is fixed money, the funds are locked.
        </div>
      </div>
    );
  }

  // Item 10 (approval Q12): the store visit is planned, agreed, attended and confirmed in the app.
  // This website panel used to run its own slot dance and a mode switch; both are retired on the
  // server (production.controller, Phase 2d), so nothing here may pretend otherwise. Read-only.
  if (event.mode === 'visit') {
    const when = event.visit_scheduled_at ? new Date(event.visit_scheduled_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : null;
    const stage = event.status === 'completed' ? 'Shoot done'
      : event.influencer_completed_at ? 'She marked the visit done — waiting for your confirmation in the app'
      : event.time_agreed_at ? `Store visit agreed for ${when}`
      : event.plan_sent_at ? `Plan sent for ${when} — time not agreed yet`
      : 'No plan sent yet';
    return (
      <div className="p-5 border-t border-[#F4F4F5]">
        <div className="text-[12px] font-bold text-[#0A0A0A] mb-1">Store visit</div>
        <div className="text-[11.5px] text-[#52525B] mb-2">{stage}</div>
        <div className="bg-[#FAFAFA] border border-[#E4E4E7] rounded-[12px] p-3 text-[11px] text-[#71717A] text-center">
          The shoot plan is managed in the app — open the collaboration on your phone to plan the visit, agree a time or confirm the shoot.
        </div>
      </div>
    );
  }

  const STATUS_BG = {
    proposed:    'bg-[#FFF7CC] text-[#6B5A00]',
    confirmed:   'bg-[#D1FAE5] text-[#047857]',
    in_progress: 'bg-[#FFF7CC] text-[#6B5A00]',
    completed:   'bg-[#D1FAE5] text-[#047857]',
    cancelled:   'bg-[#FDEEE9] text-[#B91C1C]',
  };
  const statusCls = STATUS_BG[event.status] || 'bg-[#F4F4F5] text-[#52525B]';

  return (
    <div className="p-5 border-t border-[#F4F4F5] bg-[#FAFAFA]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[12px] font-bold text-[#0A0A0A]">
            {event.mode === 'visit' ? 'Visit coordination' : 'Product shipment'}
          </div>
          <div className="text-[10.5px] text-[#71717A]">
            Influencer: {event.mode === 'visit'
              ? (event.status === 'proposed' ? 'awaiting confirmation' : event.status === 'confirmed' ? 'will visit on schedule' : 'visit complete')
              : (event.status === 'proposed' ? 'awaiting address confirmation' : event.status === 'confirmed' ? 'awaiting dispatch' : event.status === 'in_progress' ? 'package in transit' : 'package received')}
          </div>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-[0.3px] px-2 py-0.5 rounded-full ${statusCls}`}>
          {event.status.replace(/_/g, ' ')}
        </span>
      </div>

      {error && <div className="mb-3 text-[11px] text-[#B91C1C] bg-[#FDEEE9] border border-[#FBCBC4] rounded-[8px] p-2">{error}</div>}

      {event.mode === 'visit' && (() => {
        const hasLocation = !!event.visit_address;
        const hasSlot     = !!event.visit_scheduled_at;
        const isConfirmed = event.status === 'confirmed';
        const isCompleted = event.status === 'completed';
        const proposedByInfluencer = event.slot_proposed_by === 'influencer';
        const proposedByBrand      = event.slot_proposed_by === 'brand';
        const flipPending = !!event.remote_flip_requested_by;
        const flipByMe    = event.remote_flip_requested_by === 'brand';

        return (
          <div className="space-y-2">
            {flipPending && !flipByMe && !isCompleted && (
              <div className="bg-[#FFF7CC] border border-[#FFC107]/40 rounded-[10px] p-3">
                <div className="text-[11.5px] text-[#6B5A00] mb-2">
                  Influencer wants to switch to remote (no shoot, content from brief alone). Confirm?
                </div>
                <button onClick={flipToRemote} disabled={saving}
                  className="px-3 py-1.5 bg-[#FFC107] text-[#0A0A0A] text-[11px] font-bold rounded-[8px] disabled:opacity-50">
                  Confirm flip
                </button>
              </div>
            )}

            {!hasLocation && !isCompleted && (
              <>
                <div className="text-[11px] text-[#71717A] mb-1">
                  Tell the influencer WHERE to come. They&apos;ll then pick a time that works.
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={vAddress} onChange={e => setVAddress(e.target.value)} placeholder="Address line *"
                    className="col-span-2 border border-[#E4E4E7] rounded-[8px] p-2 text-[11.5px] focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFF7CC] outline-none" />
                  <input value={vCity} onChange={e => setVCity(e.target.value)} placeholder="City"
                    className="border border-[#E4E4E7] rounded-[8px] p-2 text-[11.5px] focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFF7CC] outline-none" />
                  <input value={vPincode} onChange={e => setVPincode(e.target.value)} placeholder="Pincode"
                    className="border border-[#E4E4E7] rounded-[8px] p-2 text-[11.5px] font-mono focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFF7CC] outline-none" />
                  <select value={vWindow} onChange={e => setVWindow(e.target.value)} className="border border-[#E4E4E7] rounded-[8px] p-2 text-[11.5px] bg-white focus:border-[#FFC107] outline-none">
                    <option value={30}>30 min window</option>
                    <option value={60}>1 hour window</option>
                    <option value={120}>2 hour window</option>
                    <option value={240}>Half day</option>
                  </select>
                  <div />
                  <input value={vContactName} onChange={e => setVContactName(e.target.value)} placeholder="Contact name"
                    className="border border-[#E4E4E7] rounded-[8px] p-2 text-[11.5px] focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFF7CC] outline-none" />
                  <input value={vContactPhone} onChange={e => setVContactPhone(e.target.value)} placeholder="Contact phone"
                    className="border border-[#E4E4E7] rounded-[8px] p-2 text-[11.5px] font-mono focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFF7CC] outline-none" />
                </div>
                <button onClick={saveLocationOnly} disabled={saving || !vAddress.trim()}
                  className="w-full py-2 bg-[#0A0A0A] text-[#FFC107] text-[12px] font-bold rounded-[10px] disabled:opacity-50">
                  {saving ? 'Sending…' : 'Send to influencer for scheduling'}
                </button>
              </>
            )}

            {hasLocation && !hasSlot && !isCompleted && (
              <>
                <div className="bg-white border border-[#E4E4E7] rounded-[10px] p-3 text-[11.5px]">
                  <div className="font-bold text-[#0A0A0A] mb-1">Visit location</div>
                  <div className="text-[#52525B]">{[event.visit_address, event.visit_city, event.visit_pincode].filter(Boolean).join(', ')}</div>
                </div>
                <div className="text-[11px] text-[#71717A]">Waiting for influencer to pick a slot.</div>
                {dateHint && <div className="text-[11px] text-[#6B5A00] font-bold">{dateHint}</div>}
                {!flipPending && (
                  <button onClick={flipToRemote} disabled={saving}
                    className="text-[11px] text-[#71717A] underline hover:text-[#0A0A0A]">
                    Skip the visit — switch to remote
                  </button>
                )}
              </>
            )}

            {hasLocation && hasSlot && proposedByInfluencer && event.status === 'proposed' && (
              <>
                <div className="bg-white border-2 border-[#10B981] rounded-[10px] p-3">
                  <div className="text-[10px] font-bold text-[#71717A] uppercase tracking-[0.3px] mb-1">Influencer wants to come on</div>
                  <div className="font-mono font-bold text-[14px] text-[#0A0A0A]">{fmtSlot(event.visit_scheduled_at)}</div>
                  <div className="text-[11px] text-[#71717A] mt-1">
                    {event.visit_window_minutes ? `${event.visit_window_minutes} min slot · ` : ''}
                    at {event.visit_address}
                  </div>
                </div>
                {!showCounter ? (
                  <div className="flex gap-2">
                    <button onClick={acceptSlot} disabled={saving}
                      className="flex-1 py-2 bg-[#0A0A0A] text-[#FFC107] text-[12px] font-bold rounded-[10px] disabled:opacity-50">
                      Accept slot
                    </button>
                    <button onClick={() => setShowCounter(true)} disabled={saving}
                      className="flex-1 py-2 bg-white border border-[#0A0A0A] text-[#0A0A0A] text-[12px] font-bold rounded-[10px] disabled:opacity-50">
                      Suggest another time
                    </button>
                  </div>
                ) : (
                  <div className="bg-white border border-[#E4E4E7] rounded-[10px] p-3 space-y-2">
                    <input type="datetime-local" value={cScheduledAt} onChange={e => setCScheduledAt(e.target.value)}
                      className="w-full border border-[#E4E4E7] rounded-[8px] p-2 text-[11.5px] focus:border-[#FFC107] outline-none" />
                    {dateHint && <div className="text-[11px] text-[#6B5A00] font-bold">{dateHint}</div>}
                    <div className="flex gap-2">
                      <button onClick={sendCounter} disabled={saving || !cScheduledAt}
                        className="flex-1 py-2 bg-[#0A0A0A] text-[#FFC107] text-[12px] font-bold rounded-[10px] disabled:opacity-50">
                        {saving ? 'Sending…' : 'Send counter'}
                      </button>
                      <button onClick={() => setShowCounter(false)} disabled={saving}
                        className="py-2 px-3 text-[11px] text-[#71717A] underline">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {!flipPending && (
                  <button onClick={flipToRemote} disabled={saving}
                    className="text-[11px] text-[#71717A] underline hover:text-[#0A0A0A]">
                    Skip the visit — switch to remote
                  </button>
                )}
                {event.reschedule_count_brand > 0 && (
                  <div className="text-[10.5px] text-[#71717A]">Reschedules used: {event.reschedule_count_brand} of 2</div>
                )}
              </>
            )}

            {hasLocation && hasSlot && proposedByBrand && event.status === 'proposed' && (
              <>
                <div className="bg-white border-2 border-[#FFC107] rounded-[10px] p-3">
                  <div className="text-[10px] font-bold text-[#71717A] uppercase tracking-[0.3px] mb-1">Your proposed slot</div>
                  <div className="font-mono font-bold text-[14px] text-[#0A0A0A]">{fmtSlot(event.visit_scheduled_at)}</div>
                  <div className="text-[11px] text-[#71717A] mt-1">
                    {event.visit_window_minutes ? `${event.visit_window_minutes} min slot · ` : ''}
                    at {event.visit_address}
                  </div>
                </div>
                <div className="text-[11px] text-[#71717A]">Waiting for influencer to accept or counter.</div>
                {event.reschedule_count_brand > 0 && (
                  <div className="text-[10.5px] text-[#71717A]">Reschedules used: {event.reschedule_count_brand} of 2</div>
                )}
              </>
            )}

            {isConfirmed && (
              <>
                <div className="bg-white border-2 border-[#10B981] rounded-[10px] p-3">
                  <div className="text-[10px] font-bold text-[#047857] uppercase tracking-[0.3px] mb-1">Confirmed visit</div>
                  <div className="font-mono font-bold text-[14px] text-[#0A0A0A]">{fmtSlot(event.visit_scheduled_at)}</div>
                  <div className="text-[11px] text-[#71717A] mt-1">
                    {event.visit_window_minutes ? `${event.visit_window_minutes} min slot · ` : ''}
                    at {event.visit_address}
                  </div>
                  {event.visit_contact_name && (
                    <div className="text-[11px] text-[#71717A] mt-1">
                      Contact: {event.visit_contact_name}{event.visit_contact_phone ? ` (${event.visit_contact_phone})` : ''}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {!showReschedule && (
                    <button onClick={() => setShowReschedule(true)} disabled={saving}
                      className="py-2 px-3 text-[11px] text-[#71717A] underline">
                      Reschedule
                    </button>
                  )}
                </div>
                {showReschedule && (
                  <div className="bg-white border border-[#E4E4E7] rounded-[10px] p-3 space-y-2">
                    <input type="datetime-local" value={cScheduledAt} onChange={e => setCScheduledAt(e.target.value)}
                      className="w-full border border-[#E4E4E7] rounded-[8px] p-2 text-[11.5px] focus:border-[#FFC107] outline-none" />
                    {dateHint && <div className="text-[11px] text-[#6B5A00] font-bold">{dateHint}</div>}
                    <div className="flex gap-2">
                      <button onClick={sendReschedule} disabled={saving || !cScheduledAt}
                        className="flex-1 py-2 bg-[#0A0A0A] text-[#FFC107] text-[12px] font-bold rounded-[10px] disabled:opacity-50">
                        {saving ? 'Sending…' : 'Propose new slot'}
                      </button>
                      <button onClick={() => setShowReschedule(false)} disabled={saving}
                        className="py-2 px-3 text-[11px] text-[#71717A] underline">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {event.reschedule_count_brand > 0 && (
                  <div className="text-[10.5px] text-[#71717A]">Reschedules used: {event.reschedule_count_brand} of 2</div>
                )}
              </>
            )}

            {isCompleted && (
              <div className="bg-[#D1FAE5] border border-[#10B981]/40 rounded-[10px] p-3 text-[11.5px] text-[#047857]">
                Visit complete{event.visit_completed_at ? ` on ${new Date(event.visit_completed_at).toLocaleDateString('en-IN')}` : ''}.
              </div>
            )}

            {flipPending && flipByMe && !isCompleted && (
              <div className="text-[11px] text-[#71717A]">You requested a switch to remote. Waiting for influencer to confirm.</div>
            )}
          </div>
        );
      })()}

      {(event.mode === 'shipment' || event.mode === 'remote') && (
        // Item 11 (approval §3.3) — the shipment panel is RETIRED, and is now a read-only card.
        //
        // What stood here: "Shipping to" printed from shipment_to_*, a typed courier box (with
        // a Shiprocket option in the datalist, which was never an integration), a typed AWB, an
        // expected date, and "Mark as dispatched". Three reasons it goes:
        //   · shipment_to_address_line is a CREATOR STREET ADDRESS, and the roster no longer
        //     sends it to anyone (finding 2);
        //   · the endpoints behind the button — dispatch, confirm-received — are switched off
        //     server-side, so the button could only ever show an error;
        //   · §11.2 books the parcel through INFLX, which needs a branch, a box, a weight, a
        //     wallet and a label. None of that fits a text box on a website.
        // The card names where it happens now, and nothing more.
        <div className="text-[11.5px] text-[#52525B] bg-white border border-[#E4E4E7] rounded-[8px] p-3">
          <div className="font-bold text-[#0A0A0A] mb-1">Remote shoot</div>
          <div>Parcels are managed in the app. She sends her delivery address there, you pick the
            products and book the parcel, and INFLX arranges the courier and the label.</div>
        </div>
      )}

      {log.length > 0 && (
        <details className="mt-3">
          <summary className="text-[10.5px] text-[#71717A] font-bold cursor-pointer hover:text-[#0A0A0A]">
            History ({log.length} action{log.length !== 1 ? 's' : ''})
          </summary>
          <div className="mt-2 space-y-1">
            {log.map(l => (
              <div key={l.id} className="text-[10.5px] text-[#52525B] flex gap-2">
                <span className="text-[#A1A1AA] w-24 flex-shrink-0 font-mono">{new Date(l.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-[#71717A] w-16 flex-shrink-0 capitalize">{l.actor_role}</span>
                <span>{(l.action || '').replace(/_/g, ' ')}{l.notes ? ` — ${l.notes}` : ''}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/* ─── Contract modal ─────────────────────────────────────────────────────── */

function ContractModal({ inf, contract, suggestedContentRequirements, goal, loading, brandWalletBalance = 0, platformFeePct = 8, onClose, onSign, onApprove }) {
  const safeContract = contract || {};
  const initialClauses = (() => {
    const cc = safeContract.custom_clauses;
    if (!cc) return {};
    if (typeof cc === 'string') { try { return (JSON.parse(cc).clauses) || {}; } catch { return {}; } }
    return cc.clauses || {};
  })();
  const initialNotes = (() => {
    const cc = safeContract.custom_clauses;
    if (!cc) return '';
    if (typeof cc === 'string') { try { return (JSON.parse(cc).notes) || ''; } catch { return ''; } }
    return cc.notes || '';
  })();
  const initialRequirements = (() => {
    if (safeContract.content_requirements && String(safeContract.content_requirements).trim()) {
      return String(safeContract.content_requirements);
    }
    return suggestedContentRequirements || '';
  })();
  const [clauses, setClauses]         = useState(initialClauses);
  const [extraNotes, setExtraNotes]   = useState(initialNotes);
  const [bonusAmount, setBonusAmount] = useState(String(safeContract.bonus_amount || ''));
  const [contentReq, setContentReq]   = useState(initialRequirements);
  const [productionMode, setProductionMode] = useState(safeContract.production_mode || 'remote');
  const [pdfSrc, setPdfSrc]           = useState(null);
  const [pdfError, setPdfError]       = useState(null);
  const [pdfLoading, setPdfLoading]   = useState(false);

  useEffect(() => {
    if (!safeContract.id) return;
    let cancelled = false;
    setPdfLoading(true);
    setPdfError(null);
    contractApi.getPdfUrl(safeContract.id).then(res => {
      if (cancelled) return;
      setPdfLoading(false);
      if (res?.success && res.data?.url) setPdfSrc(res.data.url);
      else setPdfError(res?.error?.message || 'Could not load contract PDF');
    });
    return () => { cancelled = true; };
  }, [safeContract.id]);

  if (!contract) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[20px] p-8 text-center font-body">
        <p className="text-[#71717A] text-[13px]">No contract found for this influencer.</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-[#F4F4F5] rounded-[10px] text-[12px] font-bold text-[#0A0A0A]">Close</button>
      </div>
    </div>
  );

  const goalLower      = (goal || 'engagement').toLowerCase();
  const showFee        = goalLower === 'engagement' || goalLower === 'hybrid';
  const showCommission = goalLower === 'conversion' || goalLower === 'hybrid';

  const isDraft     = contract.status === 'draft';
  const isReApprove = contract.status === 'pending_influencer' && !contract.influencer_signed_at;
  const isEditing   = isDraft || isReApprove;

  function toggleClause(cId) {
    setClauses(prev => {
      const cur = prev[cId];
      if (cur?.enabled) return { ...prev, [cId]: { ...cur, enabled: false } };
      const def = STANDARD_CLAUSES_WEB.find(c => c.id === cId);
      return { ...prev, [cId]: { enabled: true, value: def?.options?.[0] || null } };
    });
  }
  function setClauseValue(cId, value) {
    setClauses(prev => ({ ...prev, [cId]: { ...(prev[cId] || {}), enabled: true, value } }));
  }

  const rows = [
    { label: 'Influencer', value: contract.influencer_name || `@${inf.instagram_handle}` },
    ...(showFee ? [{ label: 'Agreed fee', value: `₹${Number(contract.influencer_fee || inf.influencer_budget || 0).toLocaleString('en-IN')}` }] : []),
    ...(showCommission ? [{ label: 'Commission', value: inf.commission_pct ? `${parseFloat(inf.commission_pct)}% per conversion` : '—' }] : []),
    { label: 'Posting date',     value: contract.posting_date ? new Date(contract.posting_date).toLocaleDateString('en-IN') : '—' },
    { label: 'Revision limit',   value: contract.revision_limit ?? 2 },
    { label: 'Influencer signed', value: contract.influencer_signed_at ? new Date(contract.influencer_signed_at).toLocaleString('en-IN') : 'Not yet' },
    { label: 'Contract status',  value: (contract.status || '').replace(/_/g, ' ') },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto font-body" onClick={onClose}>
      <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col my-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[#F4F4F5] flex items-center justify-between flex-shrink-0 bg-white rounded-t-[20px]">
          <div>
            <h2 className="font-display font-bold text-[#0A0A0A]">Review &amp; sign contract</h2>
            <p className="text-[11px] text-[#71717A] mt-0.5 font-mono">@{inf.instagram_handle} · {contract.campaign_name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F4F4F5] text-[#71717A]">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-2">
            {rows.map(r => (
              <div key={r.label} className="flex justify-between text-[12.5px] py-1.5 border-b border-[#F4F4F5] last:border-0">
                <span className="text-[#71717A] text-[11.5px] font-medium">{r.label}</span>
                <span className="font-bold text-[#0A0A0A] text-[11.5px] capitalize">{r.value}</span>
              </div>
            ))}
            {contract.content_requirements && (
              <div className="mt-3 bg-[#FAFAFA] border border-[#E4E4E7] rounded-[10px] p-3 text-[11.5px] text-[#1F1F22]">
                <div className="text-[9.5px] font-bold text-[#71717A] uppercase tracking-[0.3px] mb-1">Content requirements</div>
                <div className="whitespace-pre-wrap">{contract.content_requirements}</div>
              </div>
            )}
            {contract.id && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-[0.3px]">Contract PDF</span>
                  <div className="flex items-center gap-3">
                    {pdfSrc && (
                      <a href={pdfSrc} target="_blank" rel="noreferrer"
                        className="text-[11.5px] text-[#0A0A0A] font-bold hover:underline">Open / Download ↗</a>
                    )}
                    <button
                      onClick={async () => {
                        const res = await contractApi.regeneratePdf(contract.id);
                        if (res.success && res.data?.url) {
                          setPdfSrc(res.data.url);
                          setPdfError(null);
                        } else if (res.success) {
                          const urlRes = await contractApi.getPdfUrl(contract.id);
                          if (urlRes?.success && urlRes.data?.url) setPdfSrc(urlRes.data.url);
                        } else {
                          alert(res.error?.message || 'Regenerate failed');
                        }
                      }}
                      className="text-[11.5px] text-[#71717A] font-bold hover:text-[#0A0A0A]">
                      Regenerate
                    </button>
                  </div>
                </div>
                {pdfLoading && (
                  <div className="w-full h-[420px] border border-[#E4E4E7] rounded-[10px] bg-[#FAFAFA] flex items-center justify-center text-[11.5px] text-[#71717A]">
                    Preparing contract PDF…
                  </div>
                )}
                {pdfError && !pdfLoading && (
                  <div className="mt-2 text-[11px] text-[#B91C1C] bg-[#FDEEE9] border border-[#FBCBC4] rounded-[8px] p-2">{pdfError}</div>
                )}
                {pdfSrc && !pdfLoading && !pdfError && (
                  <iframe id={`contract-pdf-${contract.id}`} src={pdfSrc}
                    className="w-full h-[420px] border border-[#E4E4E7] rounded-[10px] bg-[#FAFAFA]" title="Contract PDF" />
                )}
                {contract.pdf_generation_error && (
                  <div className="mt-2 text-[11px] text-[#B91C1C] bg-[#FDEEE9] border border-[#FBCBC4] rounded-[8px] p-2">
                    Last PDF generation failed: {contract.pdf_generation_error}
                  </div>
                )}
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="p-5 border-t border-[#F4F4F5] space-y-4 bg-[#FFFDEB]">
              <div className="bg-[#FFF7CC] border border-[#FFC107]/50 rounded-[10px] p-3">
                <div className="text-[12px] font-bold text-[#6B5A00] mb-1">
                  {isReApprove ? 'Update terms before influencer signs' : 'Draft — your review'}
                </div>
                <div className="text-[11px] text-[#6B5A00] leading-relaxed">
                  {isReApprove
                    ? 'The influencer has not signed yet, so you can still edit the content requirements, clauses, and bonus. Click Update & Re-send to notify them.'
                    : 'The influencer accepted your offer. Confirm the content requirements, tick any optional clauses, and add a bonus if you want, then send.'}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[11.5px] font-bold text-[#0A0A0A]">Content requirements</div>
                  {suggestedContentRequirements && contentReq !== suggestedContentRequirements && (
                    <button onClick={() => setContentReq(suggestedContentRequirements)}
                      className="text-[10.5px] font-bold text-[#0A0A0A] hover:underline">
                      Restore default
                    </button>
                  )}
                </div>
                <textarea value={contentReq} onChange={e => setContentReq(e.target.value)}
                  placeholder="What exactly should the influencer create?"
                  className="w-full border border-[#E4E4E7] rounded-[10px] p-2 text-[11.5px] font-mono leading-relaxed focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFF7CC] outline-none"
                  rows={10}
                />
                <p className="text-[10px] text-[#71717A] mt-1">
                  Pre-filled from the campaign brief + deliverables. Edit freely — this text is what the influencer sees in the signed PDF.
                </p>
              </div>

              <div>
                <div className="text-[11.5px] font-bold text-[#0A0A0A] mb-2">Optional clauses</div>
                {STANDARD_CLAUSES_WEB.map(c => {
                  const cur = clauses[c.id];
                  const enabled = !!cur?.enabled;
                  return (
                    <div key={c.id} className={`mb-2 border rounded-[10px] p-2 ${enabled ? 'border-[#10B981] bg-[#D1FAE5]/40' : 'border-[#E4E4E7] bg-white'}`}>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="checkbox" checked={enabled} onChange={() => toggleClause(c.id)} className="mt-1 accent-[#FFC107]" />
                        <div className="flex-1">
                          <div className="text-[12px] font-bold text-[#0A0A0A]">{c.label}</div>
                          <div className="text-[10.5px] text-[#71717A]">{c.description}</div>
                        </div>
                      </label>
                      {enabled && c.options.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-2 ml-6">
                          {c.options.map(opt => (
                            <button key={opt} onClick={() => setClauseValue(c.id, opt)}
                              className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${cur.value === opt ? 'bg-[#0A0A0A] text-[#FFC107] border-[#0A0A0A]' : 'bg-white text-[#52525B] border-[#E4E4E7]'}`}>
                              {opt} {c.optionLabel}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div>
                <div className="text-[11.5px] font-bold text-[#0A0A0A] mb-1">Additional notes (optional)</div>
                <textarea value={extraNotes} onChange={e => setExtraNotes(e.target.value)}
                  placeholder="e.g. must wear blue shirt, tag our outlet"
                  className="w-full border border-[#E4E4E7] rounded-[10px] p-2 text-[11.5px] focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFF7CC] outline-none" rows={2} />
              </div>

              {showFee && (() => {
                const baseFeeNum  = parseFloat(contract.influencer_fee || inf.influencer_budget || 0);
                const bonusNum    = parseFloat(bonusAmount) || 0;
                const totalFeeNum = baseFeeNum + bonusNum;
                const lockNeeded  = walletLock(baseFeeNum, bonusNum, platformFeePct);
                const overByNum   = lockNeeded - brandWalletBalance;
                const isOver      = overByNum > 0.01;
                return (
                  <div>
                    <div className="text-[11.5px] font-bold text-[#0A0A0A] mb-1">Bonus on top of fee (optional)</div>
                    <div className={`flex items-center border-2 rounded-[10px] overflow-hidden ${isOver ? 'border-[#E8401A]' : 'border-[#0A0A0A]'}`}>
                      <span className="px-3 text-[15px] font-mono font-bold text-[#71717A]">₹</span>
                      <input type="number" value={bonusAmount} onChange={e => setBonusAmount(e.target.value)}
                        placeholder="0" min="0"
                        className="flex-1 py-2 px-2 text-[15px] font-mono font-bold outline-none" />
                    </div>
                    {(bonusNum > 0 || isOver) && (
                      <div className={`mt-2 rounded-[10px] p-2.5 text-[11px] ${isOver ? 'bg-[#FDEEE9] border border-[#FBCBC4]' : 'bg-[#FAFAFA] border border-[#E4E4E7]'}`}>
                        <div className="flex justify-between text-[#52525B]">
                          <span>Base fee</span>
                          <span className="font-mono">₹{baseFeeNum.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between text-[#52525B] mt-0.5">
                          <span>+ Bonus</span>
                          <span className="font-mono">₹{bonusNum.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between font-bold text-[#0A0A0A] mt-1 pt-1 border-t border-[#E4E4E7]">
                          <span>Influencer total</span>
                          <span className="font-mono">₹{totalFeeNum.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between text-[#71717A] mt-0.5">
                          <span>+ {platformFeePct}% platform fee</span>
                          <span className="font-mono">₹{(lockNeeded - totalFeeNum).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between font-bold text-[#0A0A0A] mt-1 pt-1 border-t border-[#D4D4D8]">
                          <span>Wallet escrow at signing</span>
                          <span className="font-mono">₹{lockNeeded.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-[#71717A] mt-1">
                          <span>Wallet balance</span>
                          <span className="font-mono">₹{brandWalletBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                        {isOver && (
                          <div className="mt-2 pt-2 border-t border-[#FBCBC4] text-[#B91C1C] font-bold">
                            Wallet short by ₹{overByNum.toLocaleString('en-IN', { maximumFractionDigits: 2 })}.{' '}
                            <a href="/dashboard/wallet" className="underline">Top up wallet →</a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div>
                <div className="text-[11.5px] font-bold text-[#0A0A0A] mb-1.5">How will the content be produced?</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: 'visit',    label: 'Visit',    sub: 'Influencer visits your store / location' },
                    { v: 'shipment', label: 'Shipment', sub: 'You ship product to influencer' },
                    { v: 'remote',   label: 'Remote',   sub: 'No physical exchange' },
                  ].map(opt => (
                    <button key={opt.v} type="button" onClick={() => setProductionMode(opt.v)}
                      className={`p-2.5 rounded-[10px] border-2 text-left transition-colors ${productionMode === opt.v ? 'border-[#0A0A0A] bg-[#FFFDEB]' : 'border-[#E4E4E7] bg-white hover:border-[#0A0A0A]/40'}`}>
                      <div className="text-[11.5px] font-bold text-[#0A0A0A]">{opt.label}</div>
                      <div className="text-[9.5px] text-[#71717A] leading-snug mt-0.5">{opt.sub}</div>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[#71717A] mt-1.5">
                  You&apos;ll fill in address / time / shipping details after both parties sign.
                </p>
              </div>

              {(() => {
                const baseFeeNum  = parseFloat(contract.influencer_fee || inf.influencer_budget || 0);
                const bonusNum    = parseFloat(bonusAmount) || 0;
                const lockNeeded  = walletLock(baseFeeNum, bonusNum, platformFeePct);
                const isOver      = showFee && lockNeeded > brandWalletBalance + 0.01;
                return (
                  <button onClick={() => onApprove({
                    custom_clauses:       { clauses, notes: extraNotes || null },
                    bonus_amount:         parseFloat(bonusAmount) || 0,
                    content_requirements: contentReq || null,
                    production_mode:      productionMode,
                  })} disabled={loading || isOver}
                    className="w-full py-3 bg-[#0A0A0A] text-[#FFC107] font-bold text-[13px] rounded-[12px] hover:bg-[#1F1F22] disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? 'Sending…' : isOver ? 'Top up wallet to send' : (isReApprove ? 'Update & re-send to influencer' : 'Approve & send to influencer')}
                  </button>
                );
              })()}
            </div>
          ) : contract.status === 'pending_brand' ? (
            <div className="p-5 border-t border-[#F4F4F5]">
              <p className="text-[11.5px] text-[#52525B] mb-3 leading-relaxed">
                {showFee
                  ? `By signing, you confirm the above terms. Tranche 1 (${contract.influencer_fee ? `₹${(contract.influencer_fee * 0.25).toLocaleString('en-IN')}` : '25%'}) will be queued for release.`
                  : `By signing, you confirm the above terms. Commissions will be paid as conversions happen, after the 30-day return window.`}
              </p>
              <button onClick={onSign} disabled={loading}
                className="w-full py-3 bg-[#0A0A0A] text-[#FFC107] font-bold text-[13px] rounded-[12px] hover:bg-[#1F1F22] disabled:opacity-50 transition-colors">
                {loading ? 'Signing…' : 'Sign contract'}
              </button>
            </div>
          ) : (
            <div className="p-5 border-t border-[#F4F4F5] text-center text-[11.5px] text-[#71717A]">
              {contract.brand_signed_at ? `You signed on ${new Date(contract.brand_signed_at).toLocaleString('en-IN')}` : 'Waiting for influencer signature first.'}
            </div>
          )}

          {/* Item 10 (approval §2.1, check 48): the two signature timestamps are the only definition
              of signed — never contracts.status, which four seeded rows carry as 'active' unsigned. */}
          {!!(contract.influencer_signed_at && contract.brand_signed_at) && (
            <ProductionPanel contractId={contract.id} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function CampaignInfluencersListPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') || 'all';
  const initialSetId  = searchParams.get('setId') || 'all';

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [toast, setToast]       = useState('');

  const [query, setQuery]         = useState('');
  const [setFilter, setSetFilter] = useState(initialSetId);
  const [statusFilter, setStatusFilter] = useState(initialStatus);

  const [negModal, setNegModal]         = useState(null);
  const [negLoading, setNegLoading]     = useState(false);
  const [contractModal, setContractModal] = useState(null);
  const [contractLoading, setContractLoading] = useState(false);
  const [cancellingInf, setCancellingInf]   = useState(null);
  const [actingId, setActingId]             = useState(null);

  const loadCampaign = useCallback(() => {
    return campaignApi.get(id).then(res => {
      if (res.success) setCampaign(res.data?.campaign || res.data);
      else setError(res.error?.message || 'Failed to load campaign');
    }).catch(err => setError(err.message || 'Network error'));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    loadCampaign().finally(() => setLoading(false));
  }, [id, loadCampaign]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function openNegModal(inf, goal) {
    let res;
    if (inf.negotiation_id)               res = await negotiationApi.get(inf.negotiation_id);
    else if (inf.status === 'negotiating') res = await negotiationApi.getByCampaignInfluencer(inf.id);
    else { showToast('No negotiation thread found'); return; }

    if (res.success) setNegModal({ inf, negotiation: res.data?.negotiation || res.data, goal });
    else showToast(res.error?.message || 'Failed to load negotiation');
  }

  async function handleNegRespond(action, proposedFee, note) {
    if (!negModal) return;
    setNegLoading(true);
    const negId = negModal.negotiation?.id || negModal.inf.negotiation_id;
    const res = await negotiationApi.respond(negId, { action, proposed_fee: proposedFee, note });
    setNegLoading(false);
    if (res.success) {
      showToast(action === 'accept' ? 'Offer accepted.' : action === 'decline' ? 'Offer declined.' : 'Counter sent.');
      setNegModal(null);
      loadCampaign();
    } else {
      showToast(res.error?.message || 'Failed');
    }
  }

  async function openContractModal(inf, goal) {
    const [contractRes, brandRes] = await Promise.all([
      contractApi.get(inf.id),
      brandApi.getMe(),
    ]);
    if (contractRes.success) {
      const brand = brandRes.data?.brand || brandRes.data || {};
      setContractModal({
        inf,
        contract: contractRes.data?.contract || contractRes.data,
        suggested_content_requirements: contractRes.data?.suggested_content_requirements || '',
        goal,
        brand_wallet_balance: parseFloat(brand.wallet_balance || 0),
        platform_fee_pct:     parseFloat(brand.platform_fee_pct || 8),
      });
    } else {
      showToast(contractRes.error?.message || 'Failed to load contract');
    }
  }

  // Item 7 (approval Q9): Approve & Send is switched off here. Agreements are
  // sent from the Brand app, where they are generated from the agreed terms
  // and can never be edited. Two doors with different rules is how a deal ends
  // up with a bonus and custom clauses nobody agreed to. Signing stays on the
  // web, because the server does the real money maths.
  async function handleApproveContract() {
    showToast('Agreements are sent from the Brand app.');
  }

  async function handleBrandSign() {
    if (!contractModal?.contract) return;
    setContractLoading(true);
    const res = await contractApi.brandSign(contractModal.contract.id);
    setContractLoading(false);
    if (res.success) {
      showToast('Contract signed. Tranche 1 queued.');
      setContractModal(null);
      loadCampaign();
    } else {
      showToast(res.error?.message || 'Failed');
    }
  }

  async function handleCancelInfluencer(inf) {
    if (!window.confirm(`Cancel assignment for @${inf.instagram_handle}? They will be notified.`)) return;
    setCancellingInf(inf.id);
    const res = await campaignApi.cancelInfluencer(id, inf.id);
    setCancellingInf(null);
    if (res.success) {
      showToast(`Assignment cancelled for @${inf.instagram_handle}. Refund: ₹${res.data?.refund_rupees || '0.00'}`);
      loadCampaign();
    } else {
      showToast(res.error?.message || 'Failed to cancel assignment');
    }
  }

  async function handleApplicationApprove(applicationId, handle) {
    setActingId(applicationId);
    const r = await applicationApi.approve(id, applicationId);
    setActingId(null);
    if (!r.success) { showToast(r.error?.message || 'Approve failed'); return; }
    if (r.data?.slots_filled) {
      showToast(`Approved. Slots are now full — ${r.data.closed_out_count || 0} other applicant(s) were notified.`);
    } else {
      showToast(`Approved @${handle}.`);
    }
    loadCampaign();
  }

  async function handleApplicationReject(applicationId, handle) {
    if (!confirm(`Reject @${handle}? They'll be notified.`)) return;
    setActingId(applicationId);
    const r = await applicationApi.reject(id, applicationId);
    setActingId(null);
    if (!r.success) { showToast(r.error?.message || 'Reject failed'); return; }
    showToast(`Rejected @${handle}.`);
    loadCampaign();
  }

  function handleExportCsv(rows) {
    const header = ['set','handle','name','status','offer_type','agreed_fee','commission_pct','coupon_code','posting_date'];
    const lines = [header.join(',')];
    for (const r of rows) {
      const line = [
        JSON.stringify(r._set_name || ''),
        JSON.stringify(r.instagram_handle || ''),
        JSON.stringify(r.influencer_name || ''),
        JSON.stringify(r.status || ''),
        JSON.stringify(r.offer_type || ''),
        r.agreed_fee || r.influencer_budget || '',
        r.commission_pct || '',
        JSON.stringify(r.coupon_code || ''),
        r.posting_date || '',
      ].join(',');
      lines.push(line);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${(campaign?.name || 'campaign').replace(/\s+/g, '-').toLowerCase()}-influencers.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-16 text-center text-[#71717A] font-body">
        Loading influencers…
      </div>
    );
  }
  if (error || !campaign) {
    return (
      <div className="max-w-6xl mx-auto py-16 text-center">
        <div className="font-display text-lg font-bold text-[#0A0A0A] mb-2">{error || 'Campaign not found'}</div>
        <Link href="/dashboard/campaigns" className="text-[#0A0A0A] underline font-semibold text-sm">← Back to campaigns</Link>
      </div>
    );
  }

  const sets = campaign.sets || [];
  const allRows = sets.flatMap(s => (s.influencers || []).map(ci => ({
    ...ci,
    _set_id:   s.id,
    _set_name: s.name,
    _set_goal: s.goal,
    _set_mode: s.influencer_mode,
  })));

  const statusCounts = allRows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const setCounts = sets.map(s => ({ id: s.id, name: s.name, count: (s.influencers || []).length }));

  const q = query.trim().toLowerCase();
  const filtered = allRows.filter(r => {
    if (setFilter !== 'all' && r._set_id !== setFilter) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (!q) return true;
    return (r.instagram_handle || '').toLowerCase().includes(q)
      || (r.influencer_name || '').toLowerCase().includes(q)
      || (r._set_name || '').toLowerCase().includes(q);
  });

  const STATUS_OPTIONS = ['all','applied','invited','negotiating','accepted','contracted','active','live','completed','declined','expired']
    .filter(s => s === 'all' || statusCounts[s] > 0);

  return (
    <div className="max-w-6xl font-body">
      {/* Breadcrumb */}
      <div className="font-mono text-[11px] font-medium text-[#71717A] uppercase tracking-[0.3px] mb-1.5">
        <Link href="/dashboard" className="text-[#71717A] hover:text-[#0A0A0A] no-underline">/dashboard</Link>
        <span className="text-[#A1A1AA] mx-1.5">/</span>
        <Link href="/dashboard/campaigns" className="text-[#71717A] hover:text-[#0A0A0A] no-underline">campaigns</Link>
        <span className="text-[#A1A1AA] mx-1.5">/</span>
        <Link href={`/dashboard/campaigns/${id}`} className="text-[#71717A] hover:text-[#0A0A0A] no-underline">{(campaign.id || '').slice(0, 8)}</Link>
        <span className="text-[#A1A1AA] mx-1.5">/</span>
        <span className="text-[#0A0A0A] font-bold">influencers</span>
      </div>

      {/* Header */}
      <div className="flex items-end justify-between gap-5 flex-wrap mb-5">
        <div>
          <h1 className="font-display text-[26px] font-bold text-[#0A0A0A] -tracking-[0.5px]">Influencers</h1>
          <div className="w-11 h-1 bg-[#FFC107] rounded-full mt-1.5 mb-2.5"></div>
          <div className="text-[12.5px] text-[#52525B]">
            <span className="font-mono font-semibold text-[#0A0A0A]">{allRows.length}</span> total
            <span className="text-[#D4D4D8] mx-2">·</span>
            <span className="font-medium text-[#71717A]">{campaign.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleExportCsv(filtered)}
            disabled={filtered.length === 0}
            className="px-3 py-2 bg-white border border-[#E4E4E7] rounded-[10px] text-[11.5px] font-bold text-[#0A0A0A] hover:border-[#0A0A0A] disabled:opacity-50 transition-colors"
          >
            Export CSV
          </button>
          <Link
            href={`/dashboard/campaigns/${id}`}
            className="px-3 py-2 bg-[#FFC107] text-[#0A0A0A] rounded-[10px] text-[11.5px] font-bold hover:bg-[#E0A800] transition-colors no-underline"
          >
            + Invite more
          </Link>
          <Link
            href={`/dashboard/campaigns/${id}`}
            className="px-3 py-2 bg-white border border-[#E4E4E7] rounded-[10px] text-[11.5px] font-semibold text-[#0A0A0A] hover:border-[#0A0A0A] transition-colors no-underline"
          >
            ← Back
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-[#E4E4E7] rounded-[16px] p-4 mb-5">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, handle or set…"
          className="w-full px-3.5 py-2.5 text-[13px] border border-[#E4E4E7] rounded-[10px] outline-none focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFF7CC] mb-3"
        />
        <div className="mb-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#71717A] mb-1.5">Set</div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setSetFilter('all')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${setFilter === 'all' ? 'bg-[#0A0A0A] text-[#FFC107]' : 'bg-[#F4F4F5] text-[#52525B] hover:bg-[#E4E4E7]'}`}>
              All <span className="font-mono opacity-70 ml-0.5">({allRows.length})</span>
            </button>
            {setCounts.map(sc => (
              <button key={sc.id} onClick={() => setSetFilter(sc.id)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${setFilter === sc.id ? 'bg-[#0A0A0A] text-[#FFC107]' : 'bg-[#F4F4F5] text-[#52525B] hover:bg-[#E4E4E7]'}`}>
                {sc.name} <span className="font-mono opacity-70 ml-0.5">({sc.count})</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#71717A] mb-1.5">Status</div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map(st => (
              <button key={st} onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.3px] transition-colors ${statusFilter === st ? 'bg-[#FFC107] text-[#0A0A0A]' : 'bg-[#F4F4F5] text-[#52525B] hover:bg-[#E4E4E7]'}`}>
                {st === 'all' ? 'All' : st.replace(/_/g, ' ')}
                <span className="font-mono opacity-70 ml-0.5 normal-case">({st === 'all' ? allRows.length : (statusCounts[st] || 0)})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Card grid */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E4E4E7] rounded-[16px] py-16 text-center">
          <div className="font-display font-bold text-[#0A0A0A] mb-1">No influencers match these filters</div>
          <div className="text-xs text-[#71717A]">Try clearing the search or switching tabs.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filtered.map(inf => {
            const dc = inf.deliverable_counts || { total: 0, live: 0, approved: 0, submitted: 0, under_review: 0, pending: 0 };
            const doneDel = (dc.live || 0) + (dc.approved || 0);
            const delPct  = dc.total > 0 ? Math.round((doneDel / dc.total) * 100) : 0;
            const tranches = inf.tranche_statuses || { t1: null, t2: null, t3: null };

            const goalLower      = (inf._set_goal || 'engagement').toLowerCase();
            const showFee        = goalLower === 'engagement' || goalLower === 'hybrid';
            const showCommission = goalLower === 'conversion' || goalLower === 'hybrid';
            const showTranches   = showFee;

            const isApplied     = inf.status === 'applied';
            const isNegotiating = inf.status === 'negotiating';
            const isAccepted    = inf.status === 'accepted';
            const canOpenContract = ['accepted','contracted','active','live'].includes(inf.status);
            const canCancel       = ['invited','accepted','negotiating'].includes(inf.status);
            const isBusy          = actingId === inf.id;

            return (
              <article key={inf.id} className="bg-white border border-[#E4E4E7] rounded-[16px] p-4 hover:border-[#D4D4D8] transition-colors flex flex-col">
                <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-display font-bold text-[14px] text-[#0A0A0A] truncate">
                        {inf.influencer_name || `@${inf.instagram_handle}`}
                      </span>
                      <StatusBadge status={inf.status} />
                    </div>
                    {inf.instagram_handle && (
                      <div className="font-mono text-[11.5px] text-[#71717A]">@{inf.instagram_handle}</div>
                    )}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.3px] px-2 py-0.5 rounded-full bg-[#F4F4F5] text-[#52525B] whitespace-nowrap">
                    {inf._set_name}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3 text-[11.5px]">
                  {showFee && (Number(inf.agreed_fee) > 0 || Number(inf.influencer_budget) > 0) && (
                    <div>
                      <div className="text-[9.5px] font-bold uppercase tracking-[0.3px] text-[#71717A] mb-0.5">Fee</div>
                      <div className="font-mono font-bold text-[#0A0A0A]">{fmtRupees(inf.agreed_fee || inf.influencer_budget)}</div>
                    </div>
                  )}
                  {showCommission && Number(inf.commission_pct) > 0 && (
                    <div>
                      <div className="text-[9.5px] font-bold uppercase tracking-[0.3px] text-[#71717A] mb-0.5">Commission</div>
                      <div className="font-mono font-bold text-[#0A0A0A]">{parseFloat(inf.commission_pct)}%</div>
                    </div>
                  )}
                  {inf.posting_date && (
                    <div>
                      <div className="text-[9.5px] font-bold uppercase tracking-[0.3px] text-[#71717A] mb-0.5">Posting</div>
                      <div className="font-mono font-bold text-[#0A0A0A]">{fmtDate(inf.posting_date)}</div>
                    </div>
                  )}
                  {inf.coupon_code && (
                    <div>
                      <div className="text-[9.5px] font-bold uppercase tracking-[0.3px] text-[#71717A] mb-0.5">Coupon</div>
                      <div className="font-mono font-bold text-[#0A0A0A] truncate">{inf.coupon_code}</div>
                    </div>
                  )}
                </div>

                {dc.total > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[10.5px] mb-1">
                      <span className="font-bold uppercase tracking-[0.3px] text-[#71717A]">Deliverables</span>
                      <span className="font-mono font-bold text-[#0A0A0A]">{doneDel} / {dc.total}</span>
                    </div>
                    <div className="h-1.5 bg-[#F4F4F5] rounded-full overflow-hidden">
                      <div className="h-full bg-[#0A0A0A] rounded-full transition-all" style={{ width: `${delPct}%` }} />
                    </div>
                  </div>
                )}

                {showTranches && (
                  <div className="flex items-center gap-3 text-[10.5px] mb-3 text-[#71717A]">
                    <span className="flex items-center gap-1"><TrancheDot status={tranches.t1} /> T1</span>
                    <span className="flex items-center gap-1"><TrancheDot status={tranches.t2} /> T2</span>
                    <span className="flex items-center gap-1"><TrancheDot status={tranches.t3} /> T3</span>
                  </div>
                )}

                <div className="mt-auto pt-3 border-t border-[#F4F4F5] flex items-center gap-2 flex-wrap">
                  {isApplied && (
                    <>
                      <button
                        onClick={() => handleApplicationApprove(inf.id, inf.instagram_handle)}
                        disabled={isBusy}
                        className="px-3 py-1.5 bg-[#0A0A0A] text-[#FFC107] font-bold text-[11px] rounded-[8px] hover:bg-[#1F1F22] disabled:opacity-50 transition-colors"
                      >
                        {isBusy ? '…' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleApplicationReject(inf.id, inf.instagram_handle)}
                        disabled={isBusy}
                        className="px-3 py-1.5 bg-[#FDEEE9] text-[#B91C1C] font-bold text-[11px] rounded-[8px] hover:bg-[#FBCBC4] disabled:opacity-50 transition-colors"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {isNegotiating && (
                    <button
                      onClick={() => openNegModal(inf, inf._set_goal)}
                      className="px-3 py-1.5 bg-[#FFC107] text-[#0A0A0A] font-bold text-[11px] rounded-[8px] hover:bg-[#E0A800] transition-colors"
                    >
                      Open chat
                    </button>
                  )}
                  {isAccepted && (
                    <button
                      onClick={() => openContractModal(inf, inf._set_goal)}
                      className="px-3 py-1.5 bg-[#0A0A0A] text-[#FFC107] font-bold text-[11px] rounded-[8px] hover:bg-[#1F1F22] transition-colors"
                    >
                      Sign contract
                    </button>
                  )}
                  {!isAccepted && canOpenContract && (
                    <button
                      onClick={() => openContractModal(inf, inf._set_goal)}
                      className="px-3 py-1.5 bg-white border border-[#E4E4E7] text-[#0A0A0A] font-bold text-[11px] rounded-[8px] hover:border-[#0A0A0A] transition-colors"
                    >
                      Open contract
                    </button>
                  )}
                  {canCancel && (
                    <button
                      onClick={() => handleCancelInfluencer(inf)}
                      disabled={cancellingInf === inf.id}
                      className="ml-auto px-3 py-1.5 bg-white border border-[#E4E4E7] text-[#71717A] font-bold text-[11px] rounded-[8px] hover:border-[#B91C1C] hover:text-[#B91C1C] disabled:opacity-50 transition-colors"
                    >
                      {cancellingInf === inf.id ? 'Cancelling…' : 'Cancel'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {negModal && (
        <NegotiationModal
          inf={negModal.inf}
          negotiation={negModal.negotiation}
          loading={negLoading}
          onClose={() => setNegModal(null)}
          onRespond={handleNegRespond}
        />
      )}
      {contractModal && (
        <ContractModal
          inf={contractModal.inf}
          contract={contractModal.contract}
          suggestedContentRequirements={contractModal.suggested_content_requirements}
          goal={contractModal.goal}
          loading={contractLoading}
          brandWalletBalance={contractModal.brand_wallet_balance}
          platformFeePct={contractModal.platform_fee_pct}
          onClose={() => setContractModal(null)}
          onSign={handleBrandSign}
          onApprove={handleApproveContract}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#0A0A0A] text-white text-[12px] font-semibold px-4 py-3 rounded-[12px] shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
