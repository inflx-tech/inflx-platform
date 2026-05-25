'use client';
import { useEffect, useState, useMemo } from 'react';
import { brandApi, fmtMoney } from '../../../lib/api';

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { key: '',          label: 'All' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'responded', label: 'Responded' },
  { key: 'converted', label: 'Converted' },
  { key: 'closed',    label: 'Closed' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtRelative(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const sec = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (sec < 60)      return `${sec}s ago`;
  if (sec < 3600)    return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86_400)  return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604_800) return `${Math.floor(sec / 86_400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Locked palette CSS scoped under .enq ───────────────────────────────────
const CSS = `
.enq *{box-sizing:border-box}
.enq{
  --white:#FFFFFF; --bg:#FAFAFA; --bg2:#F4F4F5;
  --yellow:#FFC107; --yellow-hover:#E0A800; --yellow-pale:#FFF7CC; --yellow-50:#FFFDEB; --yellow-text:#6B5A00;
  --ink:#0A0A0A; --ink-2:#1F1F22;
  --muted:#52525B; --muted-2:#71717A; --muted-3:#A1A1AA; --muted-4:#D4D4D8;
  --border:#E4E4E7; --border-soft:#F4F4F5;
  --success:#10B981; --success-pale:#D1FAE5; --success-text:#047857;
  --danger:#E8401A; --danger-pale:#FDEEE9; --danger-text:#B91C1C;
  --info:#1D4ED8; --info-pale:#DBEAFE;
  font-family:'Plus Jakarta Sans','Outfit',system-ui,sans-serif;
  color:var(--ink); font-size:13px; line-height:1.45;
  max-width:920px; margin:0 auto;
}
.enq .mono{font-family:'JetBrains Mono','Menlo','Consolas',monospace}

.enq .hdr{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:18px;flex-wrap:wrap}
.enq .hdr-l h1{font-family:'Outfit',sans-serif;font-size:24px;font-weight:700;color:var(--ink);letter-spacing:-.4px}
.enq .hdr-l .rule{width:42px;height:3px;background:var(--yellow);border-radius:2px;margin:6px 0}
.enq .hdr-l .sub{font-size:12px;color:var(--muted-2);max-width:560px;line-height:1.5}
.enq .cnt-chip{display:inline-flex;align-items:center;padding:5px 11px;border-radius:99px;background:var(--ink);color:var(--yellow);font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;margin-bottom:6px}
.enq .btn-ink{padding:9px 16px;background:var(--ink);color:var(--yellow);border-radius:10px;font-size:12px;font-weight:700;border:0;cursor:pointer;font-family:inherit}
.enq .btn-ink:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}
.enq .btn-yel{padding:9px 16px;background:var(--yellow);color:var(--ink);border-radius:10px;font-size:12px;font-weight:700;border:0;cursor:pointer;font-family:inherit}
.enq .btn-yel:hover:not(:disabled){background:var(--yellow-hover);color:var(--ink)}

.enq .chip-row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.enq .chip{padding:6px 12px;border-radius:99px;background:var(--white);border:1px solid var(--border);font-size:11.5px;font-weight:700;color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;gap:5px;font-family:inherit}
.enq .chip:hover:not(:disabled){border-color:var(--ink);color:var(--ink);background:var(--white)}
.enq .chip.act{background:var(--ink);border-color:var(--ink);color:var(--yellow)}
.enq .chip.act:hover:not(:disabled){background:var(--ink);border-color:var(--ink);color:var(--yellow)}
.enq .chip .ct{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;opacity:.7;margin-left:2px}

.enq .tc{background:var(--white);border:1px solid var(--border);border-radius:12px;margin-bottom:6px;overflow:hidden;transition:all .15s}
.enq .tc:hover{border-color:var(--muted-3)}
.enq .tc.open{border-color:var(--ink)}
.enq .tc-row{padding:12px 14px;display:grid;grid-template-columns:auto 1fr auto auto auto;gap:12px;align-items:center;cursor:pointer;width:100%;text-align:left;background:transparent;border:0;color:var(--ink);font-family:inherit}
.enq .tc-badge{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;padding:5px 10px;border-radius:8px;background:var(--bg2);color:var(--muted);text-transform:uppercase;letter-spacing:.3px;flex-shrink:0}
.enq .tc-mid{min-width:0;text-align:left}
.enq .tc-name{font-family:'Outfit',sans-serif;font-size:13.5px;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.enq .tc-name .dot{color:var(--muted-3);margin:0 6px}
.enq .tc-meta{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}
.enq .tc-amt{text-align:right;flex-shrink:0;min-width:90px}
.enq .tc-amt-v{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:800;color:var(--ink);letter-spacing:-.2px}
.enq .tc-amt-v.dim{font-size:11.5px;color:var(--muted-2);font-weight:600}
.enq .tc-amt-s{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted-2);margin-top:1px}
.enq .status-pill{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;padding:3px 9px;border-radius:99px;text-transform:uppercase;letter-spacing:.3px;flex-shrink:0}
.enq .status-pill.submitted{background:var(--yellow-pale);color:var(--yellow-text)}
.enq .status-pill.responded{background:var(--info-pale);color:var(--info)}
.enq .status-pill.converted{background:var(--success-pale);color:var(--success-text)}
.enq .status-pill.closed{background:var(--bg2);color:var(--muted-2)}
.enq .status-pill.unknown{background:var(--bg2);color:var(--muted)}
.enq .tc-dt{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted-2);text-align:right;min-width:74px}

.enq .tc-exp{background:var(--bg);border-top:1px solid var(--border-soft);padding:14px}
.enq .enq-form{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px}
.enq .enq-f{background:var(--white);border:1px solid var(--border-soft);border-radius:10px;padding:8px 11px;min-width:0}
.enq .enq-f.wide{grid-column:1/-1}
.enq .enq-f-l{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px}
.enq .enq-f-v{font-size:12px;color:var(--ink);font-weight:600;word-break:break-word;white-space:pre-wrap;font-family:'JetBrains Mono',monospace}
.enq .enq-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.enq .empty{background:linear-gradient(135deg,var(--yellow-50) 0%,var(--yellow-pale) 100%);border:1px solid rgba(255,193,7,.4);border-radius:18px;padding:48px 32px;text-align:center;margin-top:14px}
.enq .empty .em{font-size:48px;margin-bottom:10px}
.enq .empty .h{font-family:'Outfit',sans-serif;font-size:18px;font-weight:700;color:var(--ink);margin-bottom:6px}
.enq .empty .t{font-size:12px;color:var(--muted);max-width:480px;margin:0 auto}
.enq .spinner{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--yellow);border-radius:50%;animation:enq-spin .8s linear infinite;margin:80px auto;display:block}
@keyframes enq-spin{to{transform:rotate(360deg)}}
.enq .toast{position:fixed;bottom:24px;right:24px;background:var(--ink);color:var(--white);padding:12px 18px;border-radius:12px;font-size:13px;font-weight:600;z-index:50;box-shadow:0 10px 25px rgba(0,0,0,.15)}
.enq .toast.err{background:var(--danger);color:var(--white)}
`;

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [expanded, setExpanded]   = useState(null);
  const [toast, setToast]         = useState(null);

  async function load() {
    const res = await brandApi.getEnquiries();
    setLoading(false);
    if (res.success) setEnquiries(res.data?.enquiries || res.data || []);
  }
  useEffect(() => { load(); }, []);

  async function markConverted(id) {
    const dealValue = prompt('Enter deal value (₹):');
    if (!dealValue) return;
    const res = await brandApi.updateEnquiry(id, { status: 'converted', deal_value: parseFloat(dealValue) });
    if (res.success) { setToast({ msg: 'Marked as converted!', type: 'ok' }); setTimeout(() => setToast(null), 3000); load(); setExpanded(null); }
    else { setToast({ msg: res.error?.message || 'Failed', type: 'err' }); setTimeout(() => setToast(null), 3000); }
  }

  const counts = useMemo(() => {
    const c = { '': enquiries.length, submitted: 0, responded: 0, converted: 0, closed: 0 };
    for (const e of enquiries) if (c[e?.status] !== undefined) c[e.status] += 1;
    return c;
  }, [enquiries]);

  const visible = useMemo(() => {
    if (!statusFilter) return enquiries;
    return enquiries.filter(e => e?.status === statusFilter);
  }, [enquiries, statusFilter]);

  return (
    <div className="enq">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="hdr">
        <div className="hdr-l">
          <span className="cnt-chip">{enquiries.length} enquiries</span>
          <h1>Enquiry Leads</h1>
          <div className="rule" />
          <div className="sub">Enquiries from followers via your influencers' service pages. See also <strong>/conversions</strong> for a combined view with orders.</div>
        </div>
      </div>

      <div className="chip-row">
        {STATUS_FILTERS.map(s => {
          const isAct = statusFilter === s.key;
          return (
            <button key={s.key || 'all'} className={`chip${isAct ? ' act' : ''}`} onClick={() => { setStatusFilter(isAct ? '' : s.key); setExpanded(null); }}>
              {s.label}<span className="ct mono">{counts[s.key] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="spinner" />
      ) : visible.length === 0 ? (
        <div className="empty">
          <div className="em">💬</div>
          <div className="h">No enquiries in this view</div>
          <div className="t">When a follower submits an enquiry through one of your influencers' service pages, it'll appear here.</div>
        </div>
      ) : (
        <div>
          {visible.map(eq => {
            const isOpen = expanded === eq.id;
            const statusKey = STATUS_FILTERS.some(s => s.key === eq.status) ? eq.status : 'unknown';
            const isConverted = eq.status === 'converted';
            const form = eq.form_data_json || eq.form_data || {};
            const serviceLabel = form.service_type || form.service || 'General enquiry';
            const subBits = [];
            if (eq.influencer_name || eq.influencer_handle) subBits.push(`via @${eq.influencer_handle || eq.influencer_name}`);
            if (isConverted && eq.commission_triggered) subBits.push('commission triggered');

            return (
              <div key={eq.id} className={`tc${isOpen ? ' open' : ''}`}>
                <button className="tc-row" onClick={() => setExpanded(isOpen ? null : eq.id)} aria-expanded={isOpen}>
                  <span className="tc-badge">💬 Enquiry</span>
                  <div className="tc-mid">
                    <div className="tc-name">{eq.follower_name || 'Follower'}<span className="dot">·</span>{serviceLabel}</div>
                    <div className="tc-meta">{subBits.join(' · ') || '—'}</div>
                  </div>
                  <div className="tc-amt">
                    {isConverted && eq.deal_value != null ? (
                      <>
                        <div className="tc-amt-v">{fmtMoney(eq.deal_value)}</div>
                        <div className="tc-amt-s">deal value</div>
                      </>
                    ) : (
                      <div className="tc-amt-v dim">—</div>
                    )}
                  </div>
                  <span className={`status-pill ${statusKey}`}>● {eq.status || '—'}</span>
                  <span className="tc-dt">{fmtRelative(eq.created_at)}</span>
                </button>

                {isOpen && (
                  <div className="tc-exp">
                    <div className="enq-form">
                      {Object.entries(form).length === 0 ? (
                        <div className="enq-f wide">
                          <div className="enq-f-l">Form data</div>
                          <div className="enq-f-v">—</div>
                        </div>
                      ) : (
                        Object.entries(form).map(([k, v]) => {
                          const txt = (v == null) ? '—' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
                          const wide = txt.length > 60;
                          return (
                            <div key={k} className={`enq-f${wide ? ' wide' : ''}`}>
                              <div className="enq-f-l">{k.replace(/_/g, ' ')}</div>
                              <div className="enq-f-v">{txt}</div>
                            </div>
                          );
                        })
                      )}
                      {eq.follower_phone && (
                        <div className="enq-f">
                          <div className="enq-f-l">Customer Phone</div>
                          <div className="enq-f-v">{eq.follower_phone}</div>
                        </div>
                      )}
                      {isConverted && eq.deal_value != null && (
                        <div className="enq-f">
                          <div className="enq-f-l">Deal Value</div>
                          <div className="enq-f-v">{fmtMoney(eq.deal_value)}</div>
                        </div>
                      )}
                    </div>
                    {!isConverted && (
                      <div className="enq-actions">
                        <button className="btn-ink" onClick={() => markConverted(eq.id)}>✓ Mark as Converted</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {toast && <div className={`toast${toast.type === 'err' ? ' err' : ''}`}>{toast.msg}</div>}
    </div>
  );
}
