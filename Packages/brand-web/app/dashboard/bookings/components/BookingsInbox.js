'use client';

/**
 * BookingsInbox — Wave 2 brand-side bookings dashboard.
 *
 * Renders 4 stat tiles (Pending / Today / Upcoming / Revenue 7d), tab
 * navigation, and a paginated list of booking cards with Confirm/Reject
 * actions for pending rows. Backend: GET/POST /brands/me/bookings/*
 * (brandBookings.controller.js).
 *
 * Typography choices:
 *   - Outfit (display) for stat numbers + booking date headlines
 *   - JetBrains Mono for booking IDs, times, currency
 *   - Plus Jakarta Sans (default) for body
 */

import { useCallback, useEffect, useState } from 'react';
import { brandApi, fmtRupees } from '../../../../lib/api';

const TABS = [
  { key: 'all',      label: 'All' },
  { key: 'pending',  label: 'Pending' },
  { key: 'today',    label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past',     label: 'Past' },
];

export default function BookingsInbox() {
  const [tab, setTab]           = useState('all');
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

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl font-extrabold text-ink-1 tracking-tight">Bookings</h1>
        <p className="text-sm text-ink-3 mt-1">Incoming reservations + creator-attributed orders</p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Pending"     value={stats.pending}     hint="awaiting confirm" accent="yellow" />
        <StatTile label="Today"       value={stats.today}       hint="bookings"         accent="teal" />
        <StatTile label="Upcoming"    value={stats.upcoming}    hint="future"           accent="ink" />
        <StatTile label="Revenue 7d"  value={`₹${Math.round(Number(stats.revenue_7d || 0)).toLocaleString('en-IN')}`}
                  hint="last 7 days" accent="paper" mono />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap
              ${tab === t.key
                ? 'bg-yellow text-ink-1 shadow-sm'
                : 'bg-paper-surface text-ink-2 hover:bg-paper-deep border border-line-soft'}`}>
            {t.label}
            {t.key === 'pending' && stats.pending > 0 && (
              <span className="ml-1.5 font-mono text-[10px] font-bold">{stats.pending}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-ink-3 text-sm">Loading…</div>
      ) : error ? (
        <div className="bg-red-pale border border-red rounded-xl p-4 text-sm text-red">{error}</div>
      ) : bookings.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div className="space-y-3">
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

// ── Sub-components ──────────────────────────────────────────────────────────

function StatTile({ label, value, hint, accent, mono }) {
  const accentClasses = {
    yellow: 'bg-yellow-pale border-yellow text-yellow-deep',
    teal:   'bg-teal-pale border-teal text-teal-deep',
    ink:    'bg-paper-surface border-line-soft text-ink-1',
    paper:  'bg-paper border-line-soft text-ink-1',
  }[accent] || 'bg-paper border-line-soft text-ink-1';
  return (
    <div className={`rounded-xl border-2 p-4 ${accentClasses}`}>
      <div className="font-mono text-[10px] uppercase tracking-wider opacity-70">{label}</div>
      <div className={`font-display text-2xl font-extrabold mt-1 ${mono ? 'font-mono text-xl' : ''}`}>{value}</div>
      <div className="text-[10px] opacity-60 mt-0.5">{hint}</div>
    </div>
  );
}

function EmptyState({ tab }) {
  const COPY = {
    all:      { icon: '📋', title: 'No bookings yet',      body: "When followers book a table, they'll show up here." },
    pending:  { icon: '✨', title: 'All caught up',         body: 'No bookings awaiting your confirmation.' },
    today:    { icon: '📅', title: 'Nothing booked today', body: 'Tomorrow may be busier.' },
    upcoming: { icon: '🔮', title: 'No upcoming bookings', body: 'Run a campaign to bring in reservations.' },
    past:     { icon: '🗂️', title: 'No past bookings',     body: 'Completed bookings will archive here.' },
  }[tab] || { icon: '📋', title: 'No bookings', body: '' };
  return (
    <div className="text-center py-16 bg-paper-surface rounded-2xl border-2 border-dashed border-line-soft">
      <div className="text-5xl mb-2">{COPY.icon}</div>
      <div className="font-display text-base font-bold text-ink-1">{COPY.title}</div>
      <div className="text-sm text-ink-3 mt-1">{COPY.body}</div>
    </div>
  );
}

function BookingCard({ booking, acting, onConfirm, onReject }) {
  const b = booking;
  const reviewState = b.brand_status || 'unreviewed';
  const date = b.booking_date || b.pickup_date;
  const time = b.booking_time;
  const guests = b.guest_count;
  const isPending = reviewState === 'pending';
  const isRejected = reviewState === 'rejected' || b.booking_status === 'cancelled';

  return (
    <div className="bg-paper border border-line-soft rounded-2xl p-4 shadow-sm">
      <div className="flex items-start gap-4">
        {/* Date badge */}
        <div className="flex-shrink-0 w-16 text-center bg-paper-surface border border-line-soft rounded-xl py-2">
          <div className="font-mono text-[9px] uppercase tracking-wider text-ink-3">{fmtMonth(date)}</div>
          <div className="font-display text-2xl font-extrabold text-ink-1 leading-none mt-0.5">{fmtDay(date)}</div>
          {time && <div className="font-mono text-[10px] text-ink-2 mt-1">{fmtTime(time)}</div>}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-base font-extrabold text-ink-1 truncate">
              {b.follower_name || 'Follower'}
            </span>
            {guests > 0 && (
              <span className="font-mono text-xs text-ink-2">· party of {guests}</span>
            )}
            <BookingStatusPill state={reviewState} bookingStatus={b.booking_status} />
            {b.booking_type && (
              <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-paper-surface border border-line-soft text-ink-2">
                {b.booking_type.replace('_', ' ')}
              </span>
            )}
          </div>

          {/* Creator attribution + tracking ID */}
          <div className="flex items-center gap-2 flex-wrap mt-1.5 text-xs">
            {b.instagram_handle ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-pale text-teal-deep font-mono text-[10px] font-bold">
                <span>⭐</span>@{b.instagram_handle}
              </span>
            ) : (
              <span className="text-ink-3 font-mono text-[10px]">direct booking</span>
            )}
            {b.reference_code && (
              <span className="font-mono text-[10px] text-ink-3">
                REF <span className="text-ink-2">{b.reference_code}</span>
              </span>
            )}
          </div>

          {/* Notes from customer */}
          {b.notes && (
            <div className="mt-2 text-xs text-ink-2 italic bg-paper-surface rounded-lg px-3 py-2 border border-paper-deep">
              "{b.notes}"
            </div>
          )}

          {/* Brand review note */}
          {b.brand_review_note && (
            <div className="mt-2 text-xs text-ink-2 bg-yellow-pale rounded-lg px-3 py-2 border border-yellow">
              <span className="font-mono text-[9px] uppercase tracking-wider text-yellow-deep mr-1.5">your note</span>
              {b.brand_review_note}
            </div>
          )}
        </div>

        {/* Amount + actions */}
        <div className="flex-shrink-0 text-right space-y-2">
          <div>
            <div className="font-mono text-base font-extrabold text-ink-1">
              {fmtRupees(b.net_amount || b.gross_amount || 0)}
            </div>
            {b.advance_paid && (
              <div className="font-mono text-[10px] text-ink-3">
                advance {fmtRupees(b.advance_paid)}
              </div>
            )}
          </div>
          {isPending && !acting && (
            <div className="flex flex-col gap-1.5 items-end">
              <button onClick={onConfirm}
                className="px-3 py-1.5 rounded-lg bg-teal hover:bg-teal-deep text-white text-xs font-bold transition-colors">
                ✓ Confirm
              </button>
              <button onClick={onReject}
                className="px-3 py-1.5 rounded-lg bg-paper text-red text-xs font-bold border border-red hover:bg-red-pale transition-colors">
                ✕ Reject
              </button>
            </div>
          )}
          {acting && (
            <div className="text-[10px] text-ink-3 font-mono">working…</div>
          )}
          {!isPending && !isRejected && reviewState === 'confirmed' && (
            <div className="font-mono text-[10px] uppercase text-teal-deep">confirmed</div>
          )}
          {isRejected && (
            <div className="font-mono text-[10px] uppercase text-red">cancelled</div>
          )}
        </div>
      </div>
    </div>
  );
}

function BookingStatusPill({ state, bookingStatus }) {
  // Show the underlying cancellation if the brand rejected (the booking_status
  // gets flipped to 'cancelled' by the reject API in the same transaction).
  if (bookingStatus === 'cancelled') {
    return <Pill bg="bg-red-pale" text="text-red" label="Cancelled" />;
  }
  if (state === 'pending')    return <Pill bg="bg-yellow-pale" text="text-yellow-deep" label="Pending" />;
  if (state === 'confirmed')  return <Pill bg="bg-teal-pale"   text="text-teal-deep"   label="Confirmed" />;
  if (state === 'rejected')   return <Pill bg="bg-red-pale"    text="text-red"         label="Rejected" />;
  // Unreviewed / legacy NULL — display as confirmed since the underlying
  // booking_status defaults to 'confirmed' the moment payment clears.
  return <Pill bg="bg-paper-surface" text="text-ink-2" label="Confirmed" />;
}

function Pill({ bg, text, label }) {
  return (
    <span className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold ${bg} ${text}`}>
      {label}
    </span>
  );
}

// ── Date helpers ────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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
  // timeStr looks like "19:30:00" — chop seconds.
  return String(timeStr).slice(0, 5);
}
