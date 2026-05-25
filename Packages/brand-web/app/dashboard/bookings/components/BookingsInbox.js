'use client';

/**
 * BookingsInbox — Wave 2 brand-side bookings dashboard.
 *
 * Renders 4 stat tiles (Pending / Today / Upcoming / Revenue 7d), INK
 * sub-tab pills, and a list of date-badge booking cards with Confirm/Reject
 * for pending rows. Backend: GET/POST /brands/me/bookings/*.
 *
 * All rules scoped under .bk wrapper per Flow 16 wave2 locked palette.
 */

import { useCallback, useEffect, useState } from 'react';
import { brandApi, fmtRupees } from '../../../../lib/api';

// ─── Constants ──────────────────────────────────────────────────────────────

const TABS = [
  { key: 'pending',   label: 'Pending' },
  { key: 'today',     label: 'Today' },
  { key: 'upcoming',  label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtMonth(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return MONTHS[d.getUTCMonth()];
}
function fmtDay(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return String(d.getUTCDate()).padStart(2, '0');
}
function fmtTime(timeStr) {
  if (!timeStr) return '';
  return String(timeStr).slice(0, 5);
}

// ─── Locked palette CSS scoped under .bk ────────────────────────────────────
const CSS = `
.bk *{box-sizing:border-box}
.bk{
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
  max-width:1080px; margin:0 auto;
}
.bk .mono{font-family:'JetBrains Mono','Menlo','Consolas',monospace}

.bk .hdr{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:18px;flex-wrap:wrap}
.bk .hdr-l h1{font-family:'Outfit',sans-serif;font-size:24px;font-weight:700;color:var(--ink);letter-spacing:-.4px}
.bk .hdr-l .rule{width:42px;height:3px;background:var(--yellow);border-radius:2px;margin:6px 0}
.bk .hdr-l .sub{font-size:12px;color:var(--muted-2);max-width:560px;line-height:1.5}
.bk .cnt-chip{display:inline-flex;align-items:center;padding:5px 11px;border-radius:99px;background:var(--ink);color:var(--yellow);font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;margin-bottom:6px}

.bk .st-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}
@media (max-width: 720px){.bk .st-grid{grid-template-columns:repeat(2,1fr)}}
.bk .st{background:var(--white);border:1px solid var(--border);border-radius:12px;padding:14px 16px}
.bk .st.attn{background:var(--yellow-50);border-color:var(--yellow)}
.bk .st .l{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.5px}
.bk .st .v{font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:800;color:var(--ink);letter-spacing:-.3px;margin-top:4px}
.bk .st .v.yel{color:var(--yellow-text)}
.bk .st .v.green{color:var(--success-text)}
.bk .st .s{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted-2);margin-top:4px}

.bk .subtabs{display:inline-flex;gap:2px;background:var(--bg2);border-radius:12px;padding:4px;margin-bottom:14px;flex-wrap:wrap}
.bk .subtab{padding:8px 16px;border-radius:9px;font-size:12.5px;font-weight:700;color:var(--muted);background:transparent;display:inline-flex;align-items:center;gap:6px;border:0;cursor:pointer;font-family:inherit;white-space:nowrap}
.bk .subtab:hover:not(.act):not(:disabled){color:var(--ink);background:transparent}
.bk .subtab.act{background:var(--ink);color:var(--yellow)}
.bk .subtab.act:hover:not(:disabled){background:var(--ink);color:var(--yellow)}
.bk .subtab .ct{font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:800;background:rgba(255,255,255,.12);color:inherit;padding:2px 7px;border-radius:99px}
.bk .subtab:not(.act) .ct{background:var(--white);color:var(--muted-2)}

.bk .bc{background:var(--white);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:8px;display:flex;gap:14px;align-items:flex-start;transition:all .15s}
.bk .bc:hover{border-color:var(--muted-3)}
.bk .bc-date{flex-shrink:0;width:66px;text-align:center;background:var(--bg);border:1px solid var(--border-soft);border-radius:10px;padding:8px 4px}
.bk .bc-date .mo{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:800;color:var(--muted-2);text-transform:uppercase;letter-spacing:.5px}
.bk .bc-date .d{font-family:'Outfit',sans-serif;font-size:24px;font-weight:800;color:var(--ink);line-height:1.05;margin-top:2px}
.bk .bc-date .t{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted);margin-top:3px}
.bk .bc-body{flex:1;min-width:0}
.bk .bc-top{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:6px}
.bk .bc-name{font-family:'Outfit',sans-serif;font-size:14.5px;font-weight:700;color:var(--ink)}
.bk .bc-party{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted-2)}
.bk .bc-type{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;padding:2px 7px;border-radius:5px;background:var(--bg2);color:var(--muted-2);text-transform:uppercase;letter-spacing:.3px}
.bk .bc-attr{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px}
.bk .bc-attr .creator{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:99px;background:var(--success-pale);color:var(--success-text);font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700}
.bk .bc-attr .direct{color:var(--muted-2);font-family:'JetBrains Mono',monospace;font-size:10px}
.bk .bc-attr .ref{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted-2)}
.bk .bc-attr .ref b{color:var(--ink);font-weight:700}
.bk .bc-notes{margin-top:6px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);background:var(--bg);padding:6px 10px;border-radius:8px;font-style:italic}
.bk .bc-brand-note{margin-top:6px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);background:var(--yellow-pale);padding:6px 10px;border-radius:8px}
.bk .bc-brand-note b{font-size:9px;color:var(--yellow-text);text-transform:uppercase;letter-spacing:.3px;display:block;margin-bottom:2px;font-weight:800}
.bk .bc-right{flex-shrink:0;text-align:right;display:flex;flex-direction:column;gap:6px;align-items:flex-end;min-width:140px}
.bk .bc-amt{font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:800;color:var(--ink)}
.bk .bc-advance{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted-2)}
.bk .bc-actions{display:flex;flex-direction:column;gap:5px}
.bk .bc-actions button{padding:6px 12px;font-size:11px;font-weight:700;border-radius:8px;border:0;cursor:pointer;font-family:inherit;white-space:nowrap}
.bk .bc-actions .confirm{background:var(--ink);color:var(--yellow)}
.bk .bc-actions .confirm:hover:not(:disabled){background:var(--ink-2);color:var(--yellow)}
.bk .bc-actions .reject{background:var(--white);border:1px solid var(--danger);color:var(--danger-text)}
.bk .bc-actions .reject:hover:not(:disabled){background:var(--danger);border-color:var(--danger);color:var(--white)}
.bk .bc-actions button:disabled{opacity:.4;cursor:not-allowed}
.bk .bc-tag{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.3px}
.bk .bc-tag.confirmed{color:var(--success-text)}
.bk .bc-tag.cancelled{color:var(--danger-text)}
.bk .status-pill{font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:800;padding:3px 9px;border-radius:99px;text-transform:uppercase;letter-spacing:.3px}
.bk .status-pill.pending{background:var(--yellow-pale);color:var(--yellow-text)}
.bk .status-pill.confirmed{background:var(--success-pale);color:var(--success-text)}
.bk .status-pill.rejected{background:var(--danger-pale);color:var(--danger-text)}
.bk .status-pill.cancelled{background:var(--danger-pale);color:var(--danger-text)}
.bk .status-pill.unreviewed{background:var(--bg2);color:var(--muted-2)}

.bk .empty{background:linear-gradient(135deg,var(--yellow-50) 0%,var(--yellow-pale) 100%);border:1px solid rgba(255,193,7,.4);border-radius:18px;padding:48px 32px;text-align:center;margin-top:14px}
.bk .empty .em{font-size:48px;margin-bottom:10px}
.bk .empty .h{font-family:'Outfit',sans-serif;font-size:18px;font-weight:700;color:var(--ink);margin-bottom:6px}
.bk .empty .t{font-size:12px;color:var(--muted);max-width:480px;margin:0 auto}
.bk .spinner{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--yellow);border-radius:50%;animation:bk-spin .8s linear infinite;margin:80px auto;display:block}
@keyframes bk-spin{to{transform:rotate(360deg)}}
.bk .err{padding:14px 16px;background:var(--danger-pale);border:1px solid #FBCBC4;border-radius:12px;font-size:12.5px;color:var(--danger-text);margin-bottom:14px}
`;

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ tab }) {
  const COPY = {
    pending:   { em: '✨', h: 'All caught up',         t: 'No bookings awaiting your confirmation.' },
    today:     { em: '📅', h: 'Nothing booked today', t: 'Tomorrow may be busier.' },
    upcoming:  { em: '🔮', h: 'No upcoming bookings', t: 'Run a campaign to bring in reservations.' },
    completed: { em: '🗂',  h: 'No past bookings',     t: 'Completed bookings will archive here.' },
    cancelled: { em: '✕',  h: 'No cancellations',     t: 'Cancelled bookings will appear here.' },
  }[tab] || { em: '📋', h: 'No bookings', t: '' };
  return (
    <div className="empty">
      <div className="em">{COPY.em}</div>
      <div className="h">{COPY.h}</div>
      <div className="t">{COPY.t}</div>
    </div>
  );
}

// ─── Booking card ───────────────────────────────────────────────────────────

function BookingCard({ booking, acting, onConfirm, onReject }) {
  const b = booking;
  const reviewState = b.brand_status || 'unreviewed';
  const date = b.booking_date || b.pickup_date;
  const time = b.booking_time;
  const guests = b.guest_count;
  const isPending = reviewState === 'pending';
  const isRejected = reviewState === 'rejected' || b.booking_status === 'cancelled';
  const statusPillKey = (b.booking_status === 'cancelled') ? 'cancelled' : reviewState;

  return (
    <div className="bc">
      <div className="bc-date">
        <div className="mo">{fmtMonth(date)}</div>
        <div className="d">{fmtDay(date)}</div>
        {time && <div className="t">{fmtTime(time)}</div>}
      </div>

      <div className="bc-body">
        <div className="bc-top">
          <span className="bc-name">{b.follower_name || 'Follower'}</span>
          {guests > 0 && <span className="bc-party">· party of {guests}</span>}
          <span className={`status-pill ${statusPillKey}`}>● {statusPillKey === 'unreviewed' ? 'Confirmed' : statusPillKey}</span>
          {b.booking_type && <span className="bc-type">{String(b.booking_type).replace(/_/g, ' ')}</span>}
        </div>

        <div className="bc-attr">
          {b.instagram_handle ? (
            <span className="creator">⭐ @{b.instagram_handle}</span>
          ) : (
            <span className="direct">direct booking</span>
          )}
          {b.reference_code && (
            <span className="ref">REF <b>{b.reference_code}</b></span>
          )}
        </div>

        {b.notes && (
          <div className="bc-notes">"{b.notes}"</div>
        )}

        {b.brand_review_note && (
          <div className="bc-brand-note">
            <b>your note</b>
            {b.brand_review_note}
          </div>
        )}
      </div>

      <div className="bc-right">
        <div className="bc-amt">{fmtRupees(b.net_amount || b.gross_amount || 0)}</div>
        {b.advance_paid && (
          <div className="bc-advance">advance {fmtRupees(b.advance_paid)}</div>
        )}
        {isPending && !acting && (
          <div className="bc-actions">
            <button className="confirm" onClick={onConfirm}>✓ Confirm</button>
            <button className="reject" onClick={onReject}>✕ Reject</button>
          </div>
        )}
        {acting && (
          <div className="bc-tag">working…</div>
        )}
        {!isPending && !isRejected && reviewState === 'confirmed' && (
          <div className="bc-tag confirmed">confirmed</div>
        )}
        {isRejected && (
          <div className="bc-tag cancelled">cancelled</div>
        )}
      </div>
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function BookingsInbox() {
  const [tab, setTab]           = useState('pending');
  const [bookings, setBookings] = useState([]);
  const [stats, setStats]       = useState({ pending: 0, today: 0, upcoming: 0, revenue_7d: 0 });
  const [loading, setLoading]   = useState(true);
  const [actingId, setActingId] = useState(null);
  const [error, setError]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await brandApi.get(`/brands/me/bookings?status=${tab}`);
      if (res.success || res.data) {
        setBookings(res.data?.bookings || []);
        setStats(res.data?.stats || { pending: 0, today: 0, upcoming: 0, revenue_7d: 0 });
      } else {
        setError(res.error?.message || 'Failed to load bookings');
      }
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function act(bookingId, action) {
    setActingId(bookingId);
    try {
      const res = await brandApi.post(`/brands/me/bookings/${bookingId}/${action}`, {});
      if (res.success || res.data) {
        await load();
      } else {
        alert(res.error?.message || `${action} failed`);
      }
    } catch (e) {
      alert(e.message || 'Network error');
    } finally {
      setActingId(null);
    }
  }

  const headerCount = stats.pending > 0
    ? `${stats.pending} pending · ${stats.today} today`
    : `${stats.today} today · ${stats.upcoming} upcoming`;

  return (
    <div className="bk">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="hdr">
        <div className="hdr-l">
          <span className="cnt-chip">{headerCount}</span>
          <h1>Bookings</h1>
          <div className="rule" />
          <div className="sub">Incoming reservations + creator-attributed orders.</div>
        </div>
      </div>

      <div className="st-grid">
        <div className={`st${stats.pending > 0 ? ' attn' : ''}`}>
          <div className="l">Pending</div>
          <div className={`v${stats.pending > 0 ? ' yel' : ''}`}>{stats.pending}</div>
          <div className="s">{stats.pending > 0 ? 'Needs action' : 'All caught up'}</div>
        </div>
        <div className="st">
          <div className="l">Today</div>
          <div className="v">{stats.today}</div>
          <div className="s">bookings</div>
        </div>
        <div className="st">
          <div className="l">Upcoming</div>
          <div className="v">{stats.upcoming}</div>
          <div className="s">future</div>
        </div>
        <div className="st">
          <div className="l">Revenue 7d</div>
          <div className="v green">{fmtRupees(stats.revenue_7d || 0)}</div>
          <div className="s">last 7 days</div>
        </div>
      </div>

      <div className="subtabs" role="tablist">
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`subtab${tab === t.key ? ' act' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === 'pending' && stats.pending > 0 && <span className="ct">{stats.pending}</span>}
          </button>
        ))}
      </div>

      {error && <div className="err">{error}</div>}

      {loading ? (
        <div className="spinner" />
      ) : bookings.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div>
          {bookings.map(b => (
            <BookingCard
              key={b.id}
              booking={b}
              acting={actingId === b.id}
              onConfirm={() => act(b.id, 'confirm')}
              onReject={() => act(b.id, 'reject')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
