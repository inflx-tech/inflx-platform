'use client';
import { useEffect, useState } from 'react';
import { notificationApi } from '../../../lib/api';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  async function load() {
    const res = await notificationApi.list();
    setLoading(false);
    if (res.success) {
      setNotifications(res.data?.notifications || []);
      setUnread(res.data?.unread_count || 0);
    }
  }

  useEffect(() => { load(); }, []);

  async function markAllRead() {
    await notificationApi.markAllRead();
    load();
  }

  const notifIcon = (type) => {
    if (type?.includes('offer')) return '📩';
    if (type?.includes('campaign')) return '📣';
    if (type?.includes('contract')) return '📝';
    if (type?.includes('content') || type?.includes('deliverable')) return '🎬';
    if (type?.includes('wallet') || type?.includes('escrow')) return '💰';
    if (type?.includes('commission')) return '💵';
    return '🔔';
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-xl font-bold text-t1">Notifications</h1>
          {unread > 0 && <p className="text-xs text-orange mt-0.5">{unread} unread</p>}
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="px-4 py-2 bg-surface2 text-t2 font-semibold text-xs rounded-xl hover:bg-navy-pale hover:text-navy transition-colors">Mark all read</button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-t3 text-sm">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">🔔</div>
            <div className="font-bold text-t1 mb-1">No notifications yet</div>
            <div className="text-xs text-t3">You'll see campaign updates, offer responses, and more here</div>
          </div>
        ) : (
          notifications.map(n => (
            <div key={n.id} className={`flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 transition-colors ${!n.is_read ? 'bg-navy-pale/30' : ''}`}>
              <span className="text-xl flex-shrink-0 mt-0.5">{notifIcon(n.type)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-t1 mb-0.5">{n.title}</div>
                <div className="text-xs text-t2 leading-relaxed">{n.body}</div>
                <div className="text-[10px] text-t3 mt-1">{new Date(n.created_at).toLocaleString('en-IN')}</div>
              </div>
              {!n.is_read && <div className="w-2 h-2 rounded-full bg-orange flex-shrink-0 mt-1.5" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
